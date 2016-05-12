"use strict";

const path = require('path');
const fs = require('fs');
const _ = require('lodash');
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
const packager = require('electron-packager');
const merge = require('merge2');

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

gulp.task('copy:theme', function() {
  return gulp.src('bower_components/semantic-ui/dist/themes/default/**/*')
    .pipe(gulp.dest('dist/renderer/styles/themes/default'))
  ;
});

// Generate intermediate style files for distribution
gulp.task('build:css', ['compile:styles'], function() {
  return gulp.src('src/**/*.html')
    .pipe($.inject(gulp.src(mainBowerFiles().concat(['build/renderer/styles/**/*.css'])), {
      relative: true,
      ignorePath: ['..'],
    }))
    .pipe(gulp.dest('build'))
  ;
});

// Generate html and css for distribution
gulp.task('build:html', ['build:css'], function () {
  return gulp.src('build/renderer/**/*.html')
    .pipe($.useref({searchPath: ['bower_components', 'build/renderer/styles']}))
    .pipe($.if('*.css', $.minifyCss()))
    .pipe(gulp.dest('dist/renderer'))
  ;
});

gulp.task('build:app', function () {
  return gulp.src('src/app/**/*.js')
    .pipe($.babel({ presets: ['es2015'] }))
    .pipe($.uglify())
    .pipe(gulp.dest('dist/app'))
  ;
});

gulp.task('build:scripts', function (done) {
  bundle(createBundler([]), true, done);
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

let bundle = (bundler, forDist, done) => {
  bundler
    .bundle()
    .on('error', $.util.log)
    .on('end', () => {
      $.util.log('browserify compile success.');
      done && done()
    })
    .pipe(source('src/renderer/scripts/app.js'))
    .pipe(buffer())
    .pipe(forDist ? $.uglify() : $.nop())
    .pipe(forDist ? $.nop() : $.sourcemaps.init({ loadMaps: true }))
    .pipe(forDist ? $.nop() : $.sourcemaps.write('./'))
    .pipe($.rename({ dirname: '' }))
    .pipe(gulp.dest(forDist ? 'dist/renderer/scripts/' : 'build/renderer/scripts'));
};

gulp.task('compile:scripts', function (done) {
  bundle(createBundler([]), false, done);
});

// Minify dependent modules.
gulp.task('bundle:dependencies', function () {
  var streams = [], dependencies = [];
  var defaultModules = ['assert', 'buffer', 'console', 'constants', 'crypto', 'domain', 'events', 'http', 'https', 'os', 'path', 'punycode', 'querystring', 'stream', 'string_decoder', 'timers', 'tty', 'url', 'util', 'vm', 'zlib'],
      electronModules = ['app', 'auto-updater', 'browser-window', 'content-tracing', 'dialog', 'global-shortcut', 'ipc', 'menu', 'menu-item', 'power-monitor', 'protocol', 'tray', 'remote', 'web-frame', 'clipboard', 'crash-reporter', 'native-image', 'screen', 'shell'];

  // Because Electron's node integration, bundle files don't need to include browser-specific shim.
  var excludeModules = defaultModules.concat(electronModules);

  for(var name in packageJson.dependencies) {
    dependencies.push(name);
  }

  // create a list of dependencies' main files
  var modules = dependencies.map(function (dep) {
    var packageJson = require(dep + '/package.json');
    var main;
    if (!packageJson.main) {
      main = ['index.js'];
    } else if (Array.isArray(packageJson.main)) {
      main = packageJson.main;
    } else {
      main = [packageJson.main];
    }
    return { name: dep, main: main };
  });

  // create bundle file and minify for each main files
  modules.forEach(function (it) {
    it.main.forEach(function (entry) {
      var b = browserify('node_modules/' + it.name + '/' + entry, {
        detectGlobal: false,
        standalone: entry
      });
      excludeModules.forEach(function (moduleName) { b.exclude(moduleName) });
      streams.push(b.bundle()
                   .pipe(source(entry))
                   .pipe(buffer())
                   .pipe($.uglify())
                   .pipe(gulp.dest('dist/node_modules/' + it.name))
                  );
    });
    streams.push(
      // copy modules' package.json
      gulp.src('node_modules/' + it.name + '/package.json')
        .pipe(gulp.dest('dist/node_modules/' + it.name))
    );
  });

  return merge(streams);
});

// Write a package.json for distribution
gulp.task('packageJson', ['bundle:dependencies'], function (done) {
  var json = _.cloneDeep(packageJson);
  json.main = 'app/index.js';
  fs.writeFile('dist/package.json', JSON.stringify(json), function (err) {
    done();
  });
});

// Package for each platforms
gulp.task('package', ['win32', 'darwin'].map(function (platform) {
  var taskName = 'package:' + platform;
  gulp.task(taskName, ['dist'], function (done) {
    packager({
      dir: 'dist',
      name: packageJson.name,
      arch: 'x64',
      platform: platform,
      out: 'release',
      version: '0.37.8'
    }, function (err) {
      done();
    });
  });
  return taskName;
}));

gulp.task('build', ['inject:css', 'compile:app', 'compile:scripts']);
gulp.task('dist', ['build:html', 'build:app', 'build:scripts', 'packageJson', 'copy:theme']);

gulp.task('compile:scripts:watch', (done) => {
  let bundler = createBundler([watchify]);
  let rebundle = () => bundle(bundler, false, done);

  bundler.on('update', rebundle);
  rebundle(bundler);
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

gulp.task('default', ['serve']);
