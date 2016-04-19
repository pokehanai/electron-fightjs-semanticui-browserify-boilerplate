"use strict";

const gulp = require('gulp');
const $ = require('gulp-load-plugins')();
const browserify = require('browserify');
const watchify = require('watchify');
const babelify = require('babelify');
const mainBowerFiles = require('main-bower-files');
const source = require('vinyl-source-stream')
const buffer = require('vinyl-buffer');
const del = require('del');
const packageJson = require('./package.json');
const electronServer = require('electron-connect').server;
const hbsfy = require('hbsfy');

gulp.task('clean', () => {
  del.sync('build/*');
  del.sync('dist/*');
});

// Compile *.scss files with sourcemaps
gulp.task('compile:styles', function () {
  return gulp.src(['src/renderer/styles/**/*.scss'])
    .pipe($.sourcemaps.init())
    .pipe($.sass())
    .pipe($.sourcemaps.write('.'))
    .pipe(gulp.dest('build/renderer/styles'))
  ;
});

// Inject *.css(compiled and depedent) files into *.html
gulp.task('inject:css', ['compile:styles'], function () {
  return gulp.src('src/**/*.html')
    .pipe($.inject(gulp.src(mainBowerFiles().concat(['build/renderer/styles/**/*.css'])), {
      relative: true,
      ignorePath: ['../../build', '..'],
      addPrefix: '..'
    }))
    .pipe(gulp.dest('build'))
  ;
});

// Generate intermediate style files for distribution
gulp.task('build:css', ['compile:styles'], function() {
  return gulp.src('src/**/*.html')
    .pipe($.inject(gulp.src(mainBowerFiles().concat(['build/renderer/styles/*.css'])), {
      relative: true,
      ignorePath: ['..'],
    }))
    .pipe(gulp.dest('build'))
  ;
});

// Generate html and css for distribution
gulp.task('dist:html', ['build:css'], function () {
  return gulp.src('build/renderer/**/*.html')
    .pipe($.useref({searchPath: ['bower_components', 'build/renderer/styles']}))
    .pipe($.if('*.css', $.minifyCss()))
    .pipe(gulp.dest('dist/renderer'))
  ;
});

gulp.task('compile:app:watch', function (done) {
  done();
  return gulp.src('src/app/**/*.js')
    .pipe($.watch('src/app/**/*.js', { verbose: true }))
    .pipe($.plumber())
    .pipe($.sourcemaps.init())
    .pipe($.babel({ presets: ['es2015'] }))
    .pipe($.sourcemaps.write('.'))
    .pipe(gulp.dest('build/app'))
  ;
});

gulp.task('compile:app', () => {
  return gulp.src('src/app/**/*.js')
    .pipe($.sourcemaps.init())
    .pipe($.babel({ presets: ['es2015'] }))
    .pipe($.sourcemaps.write('.'))
    .pipe(gulp.dest('build/app'))
  ;
});

let createBundler = plugins => {
  const defaultModules = ['assert', 'buffer', 'console', 'constants', 'crypto', 'domain', 'events',
                          'http', 'https', 'os', 'path', 'punycode', 'querystring', 'stream',
                          'string_decoder', 'timers', 'tty', 'url', 'util', 'vm', 'zlib'];
  const electronModules = ['app', 'auto-updater', 'browser-window', 'content-tracing', 'dialog', 'electron',
                           'global-shortcut', 'ipc', 'ipcRenderer', 'menu', 'menu-item', 'power-monitor',
                           'protocol', 'tray', 'remote', 'web-frame', 'clipboard', 'crash-reporter',
                           'native-image', 'screen', 'shell'];

  let b = browserify({ entries: ['app.js'],
                       basedir: 'src/renderer/scripts',
                       debug: true,
                       plugin: plugins
                     })
      .transform(hbsfy)
      .transform(babelify, { presets: ['es2015'] })
  defaultModules.forEach(m => b.exclude(m));
  electronModules.forEach(m => b.exclude(m));
  return b;
};

let bundle = (bundler, forDist) => {
  bundler
    .bundle()
    .on('error', $.util.log)
    .on('end', () => $.util.log('browserify compile success.'))
    .pipe(source('src/renderer/scripts/app.js'))
    .pipe(buffer())
    .pipe(forDist ? $.uglify() : $.nop())
    .pipe(forDist ? $.nop() : $.sourcemaps.init({ loadMaps: true }))
    .pipe(forDist ? $.nop() : $.sourcemaps.write('./'))
    .pipe($.rename({ dirname: '' }))
    .pipe(gulp.dest('build/renderer/scripts'));
};

gulp.task('compile:scripts', () => {
  bundle(createBundler([]));
});

gulp.task('build', ['inject:css', 'compile:app', 'compile:scripts']);

gulp.task('compile:scripts:watch', (done) => {
  let bundler = createBundler([watchify]);
  let rebundle = () => bundle(bundler);

  bundler.on('update', rebundle);
  rebundle(bundler);
  done();
  return rebundle;
});

gulp.task('watch', ['inject:css', 'compile:app', 'compile:app:watch', 'compile:scripts:watch'], function () {
  gulp.watch(['bower.json', 'src/**/*.html', 'src/**/*.scss'], ['compile:styles', 'inject:css']);
});

gulp.task('serve', ['inject:css', 'compile:app', 'compile:app:watch', 'compile:scripts:watch'], function () {
  var electron = electronServer.create();
  electron.start();

  gulp.watch(['bower.json', 'src/**/*.html', 'src/**/*.scss'], ['compile:styles', 'inject:css']);
  gulp.watch("build/**/*", () => {
    console.log("RELOAD");
    electron.reload();
  });
});

gulp.task('default', ['watch']);
