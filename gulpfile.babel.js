/* eslint no-console:0 */

import gulp from 'gulp';
import gulpLoadPlugins from 'gulp-load-plugins';
import del from 'del';
import runSequence from 'run-sequence';
import { stream as wiredep } from 'wiredep';
import webpack from 'webpack';
import webpackConfig from './webpack.factory';
import webpackStream from 'webpack-stream';

const $ = gulpLoadPlugins();

gulp.task('extras', () => gulp.src(
  [
    'app/*.*',
    'app/_locales/**',
    '!app/scripts.babel',
    '!app/*.json',
    '!app/*.html',
    '!app/styles.scss',
  ], {
    base: 'app',
    dot: true,
  })
  .pipe(gulp.dest('dist'))
);

gulp.task('images', () => gulp.src('app/images/**/*')
  .pipe($.if($.if.isFile, $.cache($.imagemin(
    {
      progressive: true,
      interlaced: true,
      // don't remove IDs from SVGs, they are often used
      // as hooks for embedding and styling
      svgoPlugins: [{ cleanupIDs: false }],
    }))
    .on('error', err => {
      console.log(err);
      this.end();
    })))
  .pipe(gulp.dest('dist/images'))
);

gulp.task('styles', () => gulp.src('app/styles.scss/*.scss')
  .pipe($.plumber())
  .pipe($.sass.sync({
    outputStyle: 'expanded',
    precision: 10,
    includePaths: ['.'],
  }).on('error', $.sass.logError))
  .pipe(gulp.dest('app/styles'))
);

gulp.task('html', ['styles'], () => gulp.src('app/*.html')
  .pipe($.useref({ searchPath: ['.tmp', 'app', '.'] }))
  .pipe($.sourcemaps.init())
  .pipe($.if('*.js', $.uglify()))
  .pipe($.if('*.css', $.cleanCss({ compatibility: '*' })))
  .pipe($.sourcemaps.write())
  .pipe($.if('*.html', $.htmlmin({ removeComments: true, collapseWhitespace: true })))
  .pipe(gulp.dest('dist'))
);

gulp.task('chromeManifest', () => gulp.src('app/manifest.json')
  .pipe($.chromeManifest({
    buildnumber: true,
    background: {
      target: 'scripts/background.js',
      exclude: [
        'scripts/chromereload.js',
      ],
    },
  }))
  .pipe($.if('*.css', $.cleanCss({ compatibility: '*' })))
  .pipe($.if('*.js', $.sourcemaps.init()))
  .pipe($.if('*.js', $.uglify()))
  .pipe($.if('*.js', $.sourcemaps.write('.')))
  .pipe(gulp.dest('dist'))
);

function webpackTask(env, overrides) {
  return () =>
    gulp.src('app/scripts.babel/**/*.js')
      .pipe(webpackStream(webpackConfig(env, overrides), webpack))
      .pipe(gulp.dest('app/scripts'));
}
gulp.task('webpack', webpackTask());
gulp.task('webpack:watch', webpackTask('development', { watch: true }));
gulp.task('webpack:build', webpackTask('production'));

gulp.task('clean', del.bind(null, ['.tmp', 'dist', 'app/scripts', 'app/styles']));

gulp.task('app:watch', () => {
  $.livereload.listen();

  gulp.watch(
    [
      'app/*.html',
      'app/scripts/**/*.js',
      'app/images/**/*',
      'app/styles/**/*',
      'app/_locales/**/*.json',
    ])
    .on('change', $.livereload.reload);

  gulp.watch('app/styles.scss/**/*.scss', ['styles']);
  gulp.watch('bower.json', ['wiredep']);
});

gulp.task('watch', () => {
  runSequence(
    'clean',
    'html',
    ['app:watch', 'webpack:watch']
  );
});

gulp.task('size', () =>
  gulp.src('dist/**/*').pipe($.size({ title: 'build', gzip: true }))
);

gulp.task('wiredep', () => {
  gulp.src('app/*.html')
    .pipe(wiredep({
      ignorePath: /^(\.\.\/)*\.\./,
    }))
    .pipe(gulp.dest('app'));
});

gulp.task('package', () => {
  const manifest = require('./dist/manifest.json'); // eslint-disable-line global-require
  return gulp.src('dist/**')
    .pipe($.zip(`Fresh Ubuntu Search Results-${manifest.version}.zip`))
    .pipe(gulp.dest('package'));
});

gulp.task('build', cb => {
  runSequence(
    'clean',
    'webpack:build',
    'chromeManifest',
    ['html', 'images', 'extras'],
    'size',
    cb);
});

gulp.task('default', ['clean'], cb => {
  runSequence('build', cb);
});
