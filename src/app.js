import 'bootstrap';
import {inject} from 'aurelia-framework';
import {Router} from 'aurelia-router';

//import HttpClientConfig from 'aurelia-auth/app.httpClient.config';
//import FetchConfig from 'aurelia-auth/app.fetch-httpClient.config';


@inject(Router)
export class App {

  constructor(router) {
    this.router = router;
  //  this.fetchConfig = fetchConfig;
}

  configureRouter(config, router) {
    config.title = 'SmartDataPieces';
    //config.addPipelineStep('authorize', AuthorizeStep); // Add a route filter to the authorize extensibility point.
    config.map([
      {route: ['','Login'], moduleId: 'components/login/login-view', name: 'Login', title: 'Welcome'},
      {route: ['home'], moduleId: 'components/home/home-component', name: 'home', title: 'Home'}
   
    ]);

    this.router = router;
  }

  activate() {
    //this.fetchConfig.configure();
  }

}


