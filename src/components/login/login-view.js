import {inject} from 'aurelia-framework';
import {HttpClient} from 'aurelia-fetch-client';
import {json} from 'aurelia-fetch-client';
import {bindable} from 'aurelia-framework';
import {Router} from 'aurelia-router';



@inject(HttpClient,Router)
export class LoginView{

  @bindable version = {
    maj : 1,
    min : 0,
    correctif : 0,
    annee : '2018',
    mois : '07',
    jour : '10'
  }

  @bindable accountDetails = {
    firstname:"",
    lastname:"",
    email:"",
    filiale:""
  } 

  constructor(HttpClient,Router) {

    HttpClient.configure(config => {
      // config.withBaseUrl('');
       //config.useStandardConfiguration();
       config.withDefaults({
         credentials: 'include' // Valid values; omit, same-origin and include
       });
     });
     this.http = HttpClient;

     this.router= Router;
  
     console.log("Smart Data Pieces "
      + this.version.maj + '.'
      + this.version.min + '.'
      + this.version.correctif + ', build du '
      + this.version.jour + ' '
      + this.version.mois + ' '
      + this.version.annee);
  }

  register(){

    this.http.fetch('/v1/resources/inscription', {
      headers: {
        'Content-Type': 'application/json'
      },
      method: 'post',
      body:json(this.accountDetails)
    })
    

  }

  sendTracking(action){
    let current = new Date()

    let pwik = "https://piwik-int.keolis.com/piwik/piwik.php?"
    pwik += "action_name=" + encodeURI(action)
    pwik +=  "&idsite=22&rec=1"
    pwik += "&r=807717"
    pwik += "&uid=" + this.username
    pwik += "&h="+current.getHours()+"&m="+current.getMinutes()+"&s="+ current.getSeconds() 
    pwik += "&_id=80cca9c11b29e837"
    pwik += "&send_image=0&cookie=1"
    pwik += "&url=" + encodeURI("https://10.50.138.2:8010/#/home/" + action )

    this.http.fetch(pwik, {
      headers: {
     
      },
      method: 'get'
  
  
    })
  }


  authenticate(){

    let credentials ={
        login: this.username,
        password:this.password

    }
    this.http.fetch('/v1/resources/login', {
      headers: {
        'Content-Type': 'application/json'
      },
      method: 'post',
      body:json(credentials)


    })
      .then(response => response.json())
      .then(data => {
        if(data.result=="success") {
          this.sendTracking("Agrégée") 
          this.router.navigate("home");

        }
        else this.message= "Login failed"

      })

 

  };

}
