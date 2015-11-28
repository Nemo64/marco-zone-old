var gulp = require('gulp');
var browserSync = require('browser-sync').create();
var argv = require('yargs').argv;

var deployPath = '_site';
var sourceFiles = {
    scss: '_resources/*.scss',
    javascript: '_resources/*.js',
    allJavascript: ['_resources/*.js', '_resources/javascript/*.js', '_resources/javascript/**/*.js'],
    topicImages: '_images/topics/*.{png,jpg,jpeg,gif}',
    inlineImages: '_images/inline/**/*.{png,jpg,jpeg,gif}'
};
var targetDirectories = {
    assets: deployPath + '/resources',
    images: deployPath + '/images'
};

var build = {
    incremental: argv.complete != true,
    verbose: argv.verbose == true
};

gulp.task('build', ['html', 'css', 'images', 'js']);

gulp.task('serve', ['build', 'watch'], function () {
    var modRewrite = require('connect-modrewrite');
    var header = require('connect-header');

    browserSync.init({
        open: false,
        server: {
            baseDir: deployPath,
            middleware: [
                modRewrite([
                    // rewrite eg. "index" to "index.html"
                    '^(.*)/([^\.\/]+)$ $1/$2.html'
                ]),
                header({
                    // these should be the same in the _headers file
                    'X-Frame-Options': 'DENY',
                    'X-UA-Compatible': 'IE=Edge',
                    'X-XSS-Protection': '1; mode=block'
                })
            ]
        }
    });
});

gulp.task('watch', ['build'], function () {
    gulp.watch([
        '_includes/*.html',
        '_includes/**/*.html',
        '_layouts/*.html',
        '_layouts/**/*.html',
        '_data/*',
        '_data/**/*',
        '_posts/*',
        '_posts/**/*',
        'pages/*',
        'pages/**/*',
        'meta_files/*'
    ], ['html']);
    gulp.watch([
        '_resources/*.scss',
        '_resources/**/*.scss'
    ], ['css']);
    gulp.watch([
        'images/*',
        'images/**/*'
    ], ['images']);
});

gulp.task('jekyll', function (gulpCallBack) {
    var spawn = require('child_process').spawn;
    var jekyll = spawn('jekyll', [
        'build',
        '--no-watch',
        build.verbose ? undefined : '--quiet',
        '--future',
        //'--incremental',
        '--destination', deployPath
    ], {stdio: 'inherit'});

    jekyll.on('exit', function (code) {
        gulpCallBack(code === 0 ? null : 'ERROR: Jekyll process exited with code: ' + code);
    });
});

gulp.task('html', ['jekyll'], function () {
    var htmlmin = require('gulp-htmlmin');

    return gulp.src([deployPath + '/*.html', deployPath + '/**/*.html'])
        .pipe(htmlmin({
            removeComments: true,
            collapseWhitespace: true,
            collapseBooleanAttributes: true,
            removeAttributeQuotes: false,
            removeRedundantAttributes: true,
            removeEmptyAttributes: true,
            removeOptionalTags: false,
            minifyJS: true
        }))
        .pipe(gulp.dest(deployPath))
        .pipe(browserSync.stream());
});

gulp.task('sass', function () {
    var sourcemaps = require('gulp-sourcemaps');
    var sass = require('gulp-sass');
    var autoprefixer = require('gulp-autoprefixer');

    return gulp.src(sourceFiles.scss)
        .pipe(sourcemaps.init())
        .pipe(sass({outputStyle: 'compressed'}).on('error', sass.logError))
        .pipe(autoprefixer({browsers: [
            '> 0.2% in DE',
            'last 2 versions',
            'Firefox ESR',
            'not IE <= 8'
        ]}))
        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest(targetDirectories.assets))
        .pipe(browserSync.stream());
});

gulp.task('css', ['sass']);

gulp.task('jshint', function () {
    var jshint = require('gulp-jshint');

    return gulp.src(sourceFiles.allJavascript)
        .pipe(jshint())
        .pipe(jshint.reporter('default', { verbose: true }))
});

gulp.task('js', ['jshint'], function () {
    var sourcemaps = require('gulp-sourcemaps');
    var browserify = require('gulp-browserify');
    var uglify = require('gulp-uglify');

    return gulp.src(sourceFiles.javascript)
        .pipe(browserify({debug: true}))
        .pipe(sourcemaps.init({loadMaps: true}))
        .pipe(uglify({compress: {unsafe: true}}))
        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest(targetDirectories.assets));
});

gulp.task('images', function () {
    var spawn = require('gulp-spawn-shim');
    var rename = require('gulp-rename');
    var changed = require("gulp-changed");
    var merge = require('merge');

    var masterStream = require('merge-stream')();

    var resizePipe = function (images, variant, options) {
        var arguments = [];
        var changedParams = {};

        arguments.push('-', '-strip');
        arguments.push('-gravity', options.gravity || 'center');

        if (options.width || options.height) {
            var size = [options.width, options.height].join('x');
            arguments.push('-filter', 'Catrom');

            if (options.crop) {
                arguments.push('-resize', size + '^', '-crop', size + '+0+0', '+repage');
            } else if (options.upscale) {
                arguments.push('-resize', size);
            } else {
                arguments.push('-resize', size + '>');
            }

            if (options.backdrop && options.width && options.height) {
                arguments.push('-background', 'transparent', '-extent', size);

                var blurStrength = Math.max(options.width, options.height) / 24;
                var scaleFactor = 3;
                arguments.push('(', '+clone');
                arguments.push('-level', '10%,90%');
                arguments.push('-modulate', '100,150');
                arguments.push('-blur', '0x' + blurStrength);
                arguments.push('-resize', scaleFactor * 100 + '%');
                arguments.push('-channel', 'a', '-evaluate', 'multiply', '0.9');
                arguments.push('-gravity', 'East', '-crop', size + '+' + (blurStrength * scaleFactor * 2) + '+0');
                arguments.push('-page', '+0+0');
                arguments.push(')', '+swap');
            }
        }

        if (options.background || options.format === 'jpeg') {
            arguments.push('-background', options.background || 'white');
        }

        arguments.push('-flatten');

        if (options.interlace) {
            arguments.push('-interlace', 'plane');
        }

        // this has to be the last part
        switch (options.format) {
            case 'jpeg':
            case 'jpg':
                var quality = parseInt(options.quality || 90, 10);
                images = images.pipe(rename({extname: '.jpeg'}));
                changedParams.extension = '.jpeg';
                arguments.push('-quality', quality + '%');
                if (options.width && options.height) {
                    var calculatedFileSize = Math.ceil(Math.sqrt(options.width * options.height) * quality / 1000);
                    arguments.push('-define', 'jpeg:extent=' + Math.max(1, calculatedFileSize) + 'kb');
                }
                arguments.push('jpg:-');
                break;
            case 'png':
                images = images.pipe(rename({extname: '.png'}));
                changedParams.extension = '.png';
                arguments.push('-quality', '9');
                arguments.push('png:-');
                break;
            default:
                arguments.push('-');
        }

        if (build.verbose) {
            var shellescape = require('shell-escape');
            console.log(shellescape(arguments));
        }

        if (build.incremental) {
            images = images.pipe(changed(targetDirectories.images + '/' + variant, changedParams))
        }

        var stream = images
            .pipe(spawn({cmd: 'convert', args: arguments}))
            .pipe(gulp.dest(targetDirectories.images + '/' + variant))
            .pipe(browserSync.stream());

        masterStream.add(stream);
    };

    var jpgOptions = {background: '#6B0000', format: 'jpeg'};
    var gulpStreamOptions = {buffer: false};

    [96].forEach(function (size) {
        resizePipe(gulp.src(sourceFiles.topicImages, gulpStreamOptions), size, merge({
            width: size, height: size, crop: true, gravity: 'East', quality: 65
        }, jpgOptions));
    });

    [288].forEach(function (size) {
        resizePipe(gulp.src(sourceFiles.topicImages, gulpStreamOptions), size, merge({
            width: size, height: size, upscale: true, backdrop: true, quality: 65
        }, jpgOptions));
    });

    [768, 1440, 2048].forEach(function (size) {
        resizePipe(gulp.src(sourceFiles.topicImages, gulpStreamOptions), size, merge({
            width: size, height: Math.floor(size / 21 * 9), crop: true, interlace: true
        }, jpgOptions));
    });

    resizePipe(gulp.src(sourceFiles.inlineImages, gulpStreamOptions), 'inline', {width: 690});

    return masterStream;
});