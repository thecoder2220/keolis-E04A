import gulp from 'gulp';
import browserSync from 'browser-sync';
import historyApiFallback from 'connect-history-api-fallback/lib';
import {CLIOptions} from 'aurelia-cli';
import project from '../aurelia.json';
import build from './build';
import watch from './watch';


let serve = gulp.series(
  build,
  done => {
    var mlHost = '10.50.138.2';
    //var mlPassword = 'b]Jcj]Q*e;?DhTSTNTia';
    var mlPassword = 'YourCustomersAreGolden!';
    var proxy = require('http-proxy-middleware');
    var options = {
      target: 'http://10.50.138.2:8010',
      changeOrigin: true, // for vhosted sites, changes host header to match to target's host,
      secure: false
    };
    var myProxy = proxy('/v1',options);

    browserSync({
      online: false,
      open: false,
      ghostMode: false,
      port: 9010,
      server: {
        baseDir: ['.'],
        middleware: [myProxy]
      }
    }, function (err, bs) {
      if (err) return done(err);
      let urls = bs.options.get('urls').toJS();
      log(`Application Available At: ${urls.local}`);
      log(`BrowserSync Available At: ${urls.ui}`);
      done();
    })
  }
);

function log(message) {
  console.log(message); //eslint-disable-line no-console
}

function reload() {
  log('Refreshing the browser');
  browserSync.reload();
}

let run;

if (CLIOptions.hasFlag('watch')) {
  run = gulp.series(
    serve,
    done => { watch(reload); done(); }
  );
} else {
  run = serve;
}

export default run;
