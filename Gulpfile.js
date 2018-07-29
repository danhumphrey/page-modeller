(function(console) {
    'use strict';

    // package vars
    const pkg = require("./package.json");

    const gulp = require('gulp');
    const path = require('path');

    // load all plugins in "devDependencies" into the variable $
    const $ = require("gulp-load-plugins")({
        pattern: ["*"],
        scope: ["devDependencies"]
    });

    const onError = (err) => {
        $.util.log($.util.colors.bgRed($.util.colors.white(err)));     
    };
    
    const logUpdate = (msg)  => {
        $.util.log($.util.colors.bgGreen($.util.colors.white(msg))); 
    };

    const logInfo = (msg)  => {
        $.util.log($.util.colors.bgBlue($.util.colors.white(msg)));
    };

    // =============================================
    // Environment Variables
    // =============================================

    let environment = {
        dev: $.util.env.dev,
        ci: $.util.env.ci
    };

    function env(cb) {
        environment.dev = !!environment.dev;
        environment.production = !environment.dev;
        logInfo("Environment: " + (environment.dev ? 'dev' : 'production'));
        cb();
    }

    // =============================================
    // Delete the build directory
    // =============================================
    function cleanBuild(cb) {
        $.rimraf(pkg.paths.build.base, cb);
    }
    
    // =============================================
    // Delete the dist directory
    // =============================================
    function cleanDist(cb) {
        $.rimraf(pkg.paths.dist.base, cb);
    }

    // =============================================
    // Minify HTML
    // =============================================
    function minifyHtml(cb) {
        return gulp.src(pkg.paths.src.base + '*.html')
            .pipe($.minifyHtml({ collapseWhitespace: true }))
            .pipe(gulp.dest(pkg.paths.dist.base));
    }

    // =============================================
    // Manifest
    // =============================================
    function manifest(cb) {
        return gulp.src(pkg.paths.src.base + 'manifest.json')
            .pipe(gulp.dest(pkg.paths.dist.base));
    }

    // =============================================
    // Icons
    // =============================================
    function icons(cb) {
      return gulp.src(pkg.paths.src.icons + '*.png')
        .pipe(gulp.dest(pkg.paths.dist.icons));
    }

    // =============================================
    // Combines javascript files and minifies
    // =============================================
    function javascript(cb) {

        const fileCount = pkg.files.js.length -1;

        let tasks = pkg.files.js.map( function(file, index) {
            $.browserify({
                entries: pkg.paths.src.js + file,
                debug: true
            })
            .transform('babelify')
            .transform($.preprocessify, {
                includeExtensions: ['.js']
            })
            .bundle()
            .pipe($.vinylSourceStream(file))
            .pipe($.vinylBuffer())
            .pipe($.if(!environment.production,$.sourcemaps.init({ loadMaps: true })))
            .pipe($.if(!environment.production,$.sourcemaps.write('./')))
            .pipe(gulp.dest(pkg.paths.dist.js)).on('end', function() {
                if(index == fileCount) {
                    cb();
                }    
            });
         
        });
    }
    
    // =============================================
    // Compiles scss to css and minifies if `--production`
    // =============================================

    function sass(cb) {
        return gulp.src(pkg.paths.src.base + '**/*.scss')
            .pipe($.sourcemaps.init())
            .pipe($.sass.sync({
                includePaths: [
                    //'./node_modules/some/path/to/sass'
                ]
            }).on('error', $.sass.logError))
            .pipe($.if(environment.production, $.cssnano( {
                // http://cssnano.co/optimisations/
                zindex: false,
                reduceIdents: false,
                mergeIdents: false,
                discardUnused: false
            })))
            .pipe($.sourcemaps.write('./'))
            .pipe(gulp.dest(pkg.paths.dist.base))
    }

    // =============================================
    // Watch `gulp watch`
    // watches files and runs defined task on change
    // =============================================

    function watchTriggered(cb) {
        logUpdate('Extension reloaded.');
        cb();
    }

    function watch(cb) {
        gulp.watch(pkg.paths.src.base + '**/*.html').on('change', gulp.series(minifyHtml, watchTriggered));
        gulp.watch(pkg.paths.src.base + '**/*.scss').on('change', gulp.series(sass, watchTriggered));
        gulp.watch(pkg.paths.src.base + '**/*.js').on('change', gulp.series(javascript, watchTriggered));
        cb();
    }

    function launchChrome(cb) {
        
        const url = 'https://google.com';

        const distPath = path.resolve(process.cwd(), 'dist');
        const args = ['--load-extension=' + distPath];

        const chrome = $.chromeLaunch(url, { args });
        chrome.once('close', function() {
            cb();
        });
        logUpdate(`Chrome should now be open with the ${pkg.name} extension loaded.`);
    }

    gulp.task('startChrome', gulp.series(env, watch, cleanBuild, cleanDist, sass, minifyHtml, manifest, icons, javascript, launchChrome));

})(global.console);