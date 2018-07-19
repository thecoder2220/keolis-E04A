import {inject} from 'aurelia-framework';
import {HttpClient} from 'aurelia-fetch-client';
import {json} from 'aurelia-fetch-client';
import {bindable} from 'aurelia-framework';
import $ from 'jquery';
import * as Echarts from 'echarts';
import {EventAggregator} from 'aurelia-event-aggregator';
import {PLATFORM} from 'aurelia-pal';
import 'jstree';


@inject(HttpClient, Echarts, EventAggregator)
export class HomeComponent {
  views = ['Agrégée', 'Pièce', 'Qualité'];
  @bindable currentView = "Agrégée";
  position = 'top';
  trigger = 'mouseover';
  facets = {};

  logTypes = ['debug', 'info', 'prod'];
  logging = 2;


  @bindable currentSuggestionType = "ets";
  @bindable currentSuggestionLabel = "Nom ou identifiant de la filiale";
  @bindable currentSuggestionTitle = "Filiale(s)";
  @bindable sortField = "MAGPMC";

  @bindable diagramIsReady = true;
  @bindable achatsStatsReady = true;
  @bindable achatsQualiteStatsReady = true;
  @bindable achatsStats = [];
  @bindable currentPart = null;
  @bindable currentPage = 1;
  @bindable lastPageNumber = 1;
  @bindable partNames;
  @bindable etsSuggestions;
  @bindable achatsQualiteStats;
  @bindable config = {
    pageSize: 20,
    totalItems: 0
  };

  @bindable filter = {
    "ets": [{"id": "7700", "name": "KEOLIS CIF (7700)"}],
    "part": null,
    "startDate": {'month': '01', 'year': '2017'},
    "endDate": {'month': '12', 'year': '2017'},
    "minQuantity": 0
  };
  @bindable preSelected = {
    "ets": [{"id": "7700", "name": "KEOLIS CIF (7700)"}],
    "part": null,
    "startDate": {'month': '01', 'year': '2017'},
    "endDate": {'month': '12', 'year': '2017'},
    "minQuantity": 0
  };

  @bindable state = 0;
  achatsStatsForExport = [];

  /* ******************************************************************************************************************* */
  /* ***************************************************** General ***************************************************** */
  /* ******************************************************************************************************************* */


  constructor(http, Echarts, EventAggregator) {
    var logger = require('../log/logger');
    this.logger = logger;
    this.preSelectedFiliales = [];
    this.preSelectedPart = null;
    http.configure(config => {
      // config.withBaseUrl('');
      // config.useStandardConfiguration();
      config.withDefaults({
        credentials: 'include' // Valid values; omit, same-origin and include
      });
    });
    this.http = http;
    //this.echarts = Echarts;
    this.ea = EventAggregator;

    this.years = [];
    for (var i = (new Date()).getFullYear(); i > 1999; i--) {
      this.years.push(i.toString());
    }

    this.loadUserProfile();

    this.resetDate();
    this.filter = this.preSelected;
  };

  displayDownloadFile = (blob, filename = {}) => {
    if (typeof window.navigator.msSaveBlob !== 'undefined') {
      window.navigator.msSaveBlob(blob, filename);
    }
    else {
      const urlFile = window.URL.createObjectURL(blob);
      const tempLink = document.createElement('a');
      tempLink.href = urlFile;
      tempLink.setAttribute('download', filename);
      tempLink.setAttribute('target', '_blank');
      document.body.appendChild(tempLink);
      tempLink.click();
      document.body.removeChild(tempLink);
    }
  }

  loadUserProfile() {
    this.http.fetch('/v1/resources/login', {
      headers: {
        'Content-Type': 'application/json'
      },
      method: 'get'
    }).then(response => response.json()).then(data => {
      debugger;
      console.log.apply(console, this.logger.log(data, "Profile loaded"));
      this.preSelected.ets = (data.ets != null) ? [data.ets] : [];
      this.filter = this.preSelected;
      this.currentPage = 1;
      this.loadAchatsStats();
      this.loadEcartMoyen();
    })
  };


  isActive(viewName, currentView) {
    if (this.currentView == viewName) return "danger";
    else return "secondary"
  };


  setCurrentView(viewName) {
    console.log.apply(console, this.logger.log(null, "Change view :", viewName));
    this.sendTracking(viewName)

    if (viewName == "Agrégée") {
      if (this.currentView == "Pièce") {
        this.setCurrentPart(null, null)
      }

      this.filter.part = null;
      this.preSelected.part = null;
      var oldView = this.currentView;
      this.currentView = viewName;
      if (oldView != "Qualité") {
        this.refresh();
      }
    }

    else if (viewName == "Qualité") {
      if (this.currentView == "Pièce") {
        this.setCurrentPart(null, null)
      }

      if (this.currentView == "Agrégée") {
        this.currentView = viewName
        this.loadQualityStats();
      } else {
        this.currentView = viewName
        this.refresh();
      }
    }

    else if (viewName == "Pièce") {
      this.setCurrentSuggestionType('part')
      this.currentView = viewName
    }
  };


  refresh() {
    //if (this.currentView == "Agrégée" || this.currentView == "Qualité") {
    if (this.currentView == "Pièce") {
      this.ea.publish('partChanged', {message: 'Part selection changed'});
    }
    this.achatsStats.slice(0);
    this.loadAchatsStats();
    this.loadEcartMoyen();
    this.loadYearStats();
  };


  attached() {
    console.log.apply(console, this.logger.log(null, "DOM setup"));
    var me = this;
    $.ajax({
      url: "../static/Consolidation_filiales.csv",
      success: function (data) {
        me.initFilialesData(data, me);
      }
    });

    this.loadYearStats();
  };


  /* ********************************************************************************************************************* */
  /* ****************************************************** Filters ****************************************************** */
  /* ********************************************************************************************************************* */


  validateFilter() {
    console.log.apply(console, this.logger.log(null, "Filtrage validated"));
    this.filter = this.preSelected;
    this.refresh();
  };


  resetDate() {
    let endDate = new Date()
    let startDate = new Date()
    startDate.setMonth(endDate.getMonth() - 12)
    let endMonth = (endDate.getMonth() + 1 > 9) ? endDate.getMonth() + 1 : "0".concat(endDate.getMonth() + 1)
    let endYear = endDate.getFullYear()
    let startMonth = (startDate.getMonth() + 1 > 9) ? startDate.getMonth() + 1 : "0".concat(startDate.getMonth() + 1)
    let startYear = startDate.getFullYear()

    this.preSelected.startDate.year = startYear.toString();
    this.preSelected.startDate.month = startMonth;
    this.preSelected.startDate.day = "01";
    this.preSelected.endDate.year = endYear.toString();
    this.preSelected.endDate.month = endMonth;
    this.preSelected.endDate.day = "01";
  };


  resetFiltrage() {
    console.log.apply(console, this.logger.log(null, "Filtrage reseted"));
    this.setCurrentView("Agrégée");
    this.resetDate();
    this.loadUserProfile();
    this.minQuantity = 0;
  };


  /* ******************************************************************************************************************** */
  /* ********************************************** Tableau Agrégé/Qualité ********************************************** */
  /* ******************************************************************************************************************** */


  loadAchatsStats() {
    this.achatsStats = [];
    this.achatsStatsReady = false;
    const ets = (this.filter.ets != null) ? this.filter.ets.map(function (item) {
      return "&rs:ets=" + item.id;
    }).join("") : ""
    const startDate = this.getStartDate();
    const endDate = this.getEndDate();
    const part = this.filter.part != null ? "&rs:part=" + this.filter.part.id : "";

    this.http.fetch('/v1/resources/achatsStats2?rs:default=' + part + ets
      + '&rs:currentPage=' + this.currentPage
      + "&rs:pageSize=" + this.config.pageSize
      + "&rs:startDate=" + startDate
      + "&rs:endDate=" + endDate
      + "&rs:sort=" + this.sortField
      + "&rs:minQuantity=" + this.filter.minQuantity
      , {
        headers: {
          'Content-Type': 'application/json'
        },
        method: 'get'
      }).then(response => response.json()).then(data => {
      console.log.apply(console, this.logger.log(data, "Data achats loaded"));
      this.currentUser = data.currentUser;
      this.achatsStats = data.results;
      this.achatsStatsReady = true;
      this.config.totalItems = data.totalItems;
      this.lastPageNumber = Math.ceil(data.totalItems / this.config.pageSize);
      //this.processSumGAP()
      this.loadPartsNames();
      if (this.currentView == "Qualité") {
        this.loadQualityStats();
      }
    })
  };


  loadQualityStats() {
    let parts = {
      parts: this.achatsStats.map(function (item) {
        return item["main.LignesCommande.RefFabricant"]
      })
    };
    const ets = (this.filter.ets != null) ? this.filter.ets.map(function (item) {
      return "&rs:ets=" + item.id
    }).join("") : ""
    const startDate = this.getStartDate();
    const endDate = this.getEndDate();
    this.achatsQualiteStats = [];
    this.achatsQualiteStatsReady = false;

    this.http.fetch('/v1/resources/qualityStats?rs:part=' + ets
      + '&rs:currentPage=' + this.currentPage
      + "&rs:pageSize=" + this.config.pageSize
      + "&rs:startDate=" + startDate
      + "&rs:endDate=" + endDate
      , {
        headers: {
          'Content-Type': 'application/json'
        },
        method: 'post',
        body: json(parts)
      }).then(response => response.json()).then(data => {
      console.log.apply(console, this.logger.log(data, "Data quality loaded"));
      this.achatsQualiteStats = data;
      this.achatsQualiteStatsReady = true;
      for (var achat of this.achatsStats) {
        achat.showQuality = this.showQualityLine(achat);
      }
    })
  };


  setSortField(field) {
    let reload = (field != this.sortField) ? true : false;
    this.sortField = field;
    if (reload) this.loadAchatsStats();
  };


  showQualityLine(achat) {
    if (achat != null && this.achatsQualiteStats != null) {
      var moreThanTwenty = 0;
      var qualities = this.achatsQualiteStats[achat["main.LignesCommande.RefFabricant"]][achat["main.LignesCommande.Article"]];
      if (qualities["ORI"] != null && qualities["ORI"]["SomQuantiteFacturee"] / achat["SomQuantiteFacturee"] > 0.2) moreThanTwenty++
      if (qualities["ORF"] != null && qualities["ORF"]["SomQuantiteFacturee"] / achat["SomQuantiteFacturee"] > 0.2) moreThanTwenty++
      if (qualities["PQE"] != null && qualities["PQE"]["SomQuantiteFacturee"] / achat["SomQuantiteFacturee"] > 0.2) moreThanTwenty++

      return moreThanTwenty >= 2
    } else return false
  };


  setPage(num) {
    if (this.currentPage + num >= 1) this.currentPage += num;
    this.loadAchatsStats();
  };

  gotoFirstPage() {
    this.currentPage = 1;
    this.loadAchatsStats();
  };

  gotoLastPage() {
    this.currentPage = this.lastPageNumber;
    this.loadAchatsStats();
  };

  /*currentPageChanged(newValue, oldValue) {
   if (newValue != oldValue) this.loadAchatsStats()
   };*/


  /* ********************************************************************************************************************* */
  /* ***************************************************** Vue Pièce ***************************************************** */
  /* ********************************************************************************************************************* */


  setCurrentPart(partRef, name, ligneCommande) {
    console.log.apply(console, this.logger.log(null, "Changement piece :", name, '(' + partRef + ')'));
    if (this.filter.part == null || this.filter.part.id != partRef) {
      if (partRef != null && partRef != "") {
        this.filter.part = {
          id: partRef,
          name: name
        }
        this.preSelected.part = this.filter.part;
        this.preSelectedPart = this.filter.part;
        this.currentView = "Pièce";

        this.ea.publish('partChanged', {message: 'Part selection changed'});
      }
      else {
        this.filter.part = null;
        this.preSelected.part = null;
        this.preSelectedPart = null;
        this.currentView = "Agrégée"
      }

      if (ligneCommande != null) {
        this.achatsStats = [ligneCommande];
        this.loadYearStats()
      }
      else {
        this.loadAchatsStats();
        this.loadYearStats()
      }
    }
  };


  loadPartsNames() {
    let query = {
      "parts": this.achatsStats.map(function (item) {
        return item["main.LignesCommande.RefFabricant"]
      })
    }

    this.http.fetch('/v1/resources/partName', {
      headers: {
        'Content-Type': 'application/json'
      },
      method: 'post',
      body: json(query)
    }).then(response => response.json()).then(data => {
      console.log.apply(console, this.logger.log(data, "Data part names loaded"));
      this.partNames = data;
    })
  };


  loadParts(filter, limit) {
    let promise = this.http.fetch('/v1/resources/part?rs:filter=' + filter, {
      headers: {
        'Content-Type': 'application/json'
      },
      method: 'get'
    }).then(response => response.json()).then(data => {
      console.log.apply(console, this.logger.log({
        'dataLoaded': data,
        'filters': filter
      }, "Data pieces loaded"));
      this.suggestions = data
    })
    return promise;
  };


  /* ******************************************************************************************************************** */
  /* ****************************************************** Modals ****************************************************** */
  /* ******************************************************************************************************************** */


  setCurrentSuggestionType(suggestType) {
    this.suggestions = [];
    this.suggestValue = "";

    if (suggestType == "ets") {
      this.currentSuggestionType = "ets";
      this.currentSuggestionLabel = "Nom ou identifiant de la filiale";
      this.currentSuggestionTitle = "Filiale(s)";
    }
    if (suggestType == "part") {
      this.currentSuggestionType = "part";
      this.currentSuggestionLabel = "Libellé ou référence fabricant de la pièce";
      this.currentSuggestionTitle = "Pièces(s)";
    }
  };


  setCurrentETS(etsRef, name) {
    if (this.preSelectedFiliales.filter(function (item) {
        return item.id == etsRef
      }).length == 0) {
      if (etsRef != null && etsRef != "")
        this.preSelectedFiliales.push({
          id: etsRef,
          name: name
        });
      else
        this.preSelectedFiliales = null
    }
  };


  removeFromCurrentSelection(objectRef, objectName) {
    if (this.currentSuggestionType == "ets")
      this.removeFromCurrentETS(objectRef, objectName)
    if (this.currentSuggestionType == "part")
      this.removeFromCurrentPart(objectRef, objectName)
  };


  initFilialesData(data, me) {
    var mySources = {};
    var allRows = data.split(/\r?\n|\r/);
    for (var singleRow = 0; singleRow < allRows.length; singleRow++) {
      // Code finance ; ID Qualiac ; ID WINATEL ; Filiale ; Secteur ; DR
      var rowCells = allRows[singleRow].split(';');

      if (rowCells[1] && rowCells[1] != "#N/A" && rowCells[1] != "NA" && rowCells[5] != "DR") {
        if (mySources[rowCells[5]] == undefined) {
          mySources[rowCells[5]] = {};
        }
        if (mySources[rowCells[5]][rowCells[4]] == undefined) {
          mySources[rowCells[5]][rowCells[4]] = [];
        }
        mySources[rowCells[5]][rowCells[4]].push({
          'IDQualiac': rowCells[1],
          'filiale': rowCells[3]
        });
      }
    }
    ;

    // Mise en forme des données
    var myData = [];
    var listDR = Object.keys(mySources);
    for (var DR in listDR) {
      var actDR = mySources[listDR[DR]];
      var childrenDR = [];
      var listSecteur = Object.keys(actDR);
      for (var secteur in listSecteur) {
        var actSecteur = actDR[listSecteur[secteur]];
        var childrenSecteur = [];
        for (var filiale = 0; filiale < actSecteur.length; filiale++) {
          if (actSecteur[filiale]['IDQualiac'] != '170')
            childrenSecteur.push({
              'text': actSecteur[filiale]['filiale'],
              'id': actSecteur[filiale]['IDQualiac']
            });
          else
            childrenSecteur.push({
              'text': actSecteur[filiale]['filiale'],
              'state': {'selected': true},
              'id': actSecteur[filiale]['IDQualiac']
            });
        }
        var newSecteur = {'text': listSecteur[secteur], 'children': childrenSecteur};
        childrenDR.push(newSecteur);
      }
      var newDR = {'text': listDR[DR], 'children': childrenDR};
      myData.push(newDR);
    }
    myData = {
      'text': 'Toutes les filiales',
      'state': {'opened': true, 'selected': true},
      'children': myData
    };
    me.initMultiSelectTree(myData, me);
  };


  initMultiSelectTree(myData, me) {
    // Création modal filiale
    $('#multiselectTreeFiliale').jstree({
      'plugins': ['search', 'checkbox'],
      'core': {
        'data': myData,
        "themes": {
          "icons": false,
          "dots": false
        },
        "expand_selected_onload": false
      },
      'search': {
        'show_only_matches': true,
        'show_only_matches_children': true
      }
    });

    $('#searchFiliale').on("keyup change", function () {
      $('#multiselectTreeFiliale').jstree(true).search($(this).val())
    });

    $('#multiselectTreeFiliale').on('changed.jstree', function (e, data) {
      var objects = data.instance.get_selected(true);

      var find = false;
      for (var obj = 0; obj < objects.length && !find; obj++) {
        if (objects[obj]['text'] == "Toutes les filiales") {
          find = true;
        }
      }

      if (find) {
        me.preSelectedFiliales = [];
      } else {
        var leaves = $.grep(objects, function (o) {
          return data.instance.is_leaf(o)
        });

        me.preSelectedFiliales = [];
        for (var leave in leaves) {
          me.setCurrentETS(leaves[leave]['id'], leaves[leave]['text']);
        }
      }
    });
    console.log.apply(console, me.logger.log(myData, "Multi select tree filiale initialized"));
  };


  validateModal() {
    console.log.apply(console, this.logger.log(null, "Modal validated"));
    if (this.currentSuggestionType == 'ets') {
      this.preSelected.ets = this.preSelectedFiliales;
    } else {
      var load = this.preSelected.part == null;
      this.preSelected.part = this.preSelectedPart;
      if (load) {
        this.validateFilter();
      }
    }
  };


  preSelectPart(partRef, name) {
    this.preSelectedPart = {id: partRef, name: name};
  };


  loadSuggestions(filter, limit) {
    if (this.currentSuggestionType == "ets")
      this.loadETS(filter, limit)
    if (this.currentSuggestionType == "part")
      this.loadParts(filter, limit)
  };


  loadETS(filter, limit) {
    filter = filter != null ? filter : "";
    let promise = this.http.fetch('/v1/resources/etablissement?rs:filter=' + filter, {
      headers: {
        'Content-Type': 'application/json'
      },
      method: 'get'
    }).then(response => response.json()).then(data => {
      console.log.apply(console, this.logger.log({
        'dataLoaded': data,
        'filters': filter
      }, "Data filtered filiales loaded"));
      this.suggestions = data;
    })
    return promise;
  };


  /* ********************************************************************************************************************** */
  /* ************************************************** Graph and calcul ************************************************** */
  /* ********************************************************************************************************************** */


  loadEcartMoyen() {
    const ets = (this.filter.ets != null) ? this.filter.ets.map(function (item) {
      return "&rs:ets=" + item.id
    }).join("") : ""
    const startDate = this.getStartDate();
    const endDate = this.getEndDate();

    this.http.fetch('/v1/resources/ecartAchatMoyen?rs:part=' + ets
      + '&rs:currentPage=' + this.currentPage
      + "&rs:pageSize=" + this.config.pageSize
      + "&rs:startDate=" + startDate
      + "&rs:endDate=" + endDate
      , {
        headers: {
          'Content-Type': 'application/json'
        },
        method: 'get'


      }).then(response => response.json()).then(data => {
      console.log.apply(console, this.logger.log(data, "Data ecart moyen loaded"));
      this.ecartMoyen = data.ratio;

    })
  };


  processSumGAP() {
    var totalMAGPMC = 0;
    var totalMAGPMT = 0;

    for (var i = 0; i < this.achatsStats.length; i++) {
      totalMAGPMC += this.achatsStats[i]["MAGPMC"]
      totalMAGPMT += this.achatsStats[i]["MAGPMT"]
    }
    this.achatsStats[0]["MAGPMCCUMUL"] = this.achatsStats[0]["MAGPMC"] / totalMAGPMC
    this.achatsStats[0]["MAGPMTCUMUL"] = this.achatsStats[0]["MAGPMT"] / totalMAGPMT

    for (var i = 1; i < this.achatsStats.length; i++) {
      this.achatsStats[i]["MAGPMCCUMUL"] = this.achatsStats[i - 1]["MAGPMCCUMUL"] + (this.achatsStats[i]["MAGPMC"]) / totalMAGPMC
      this.achatsStats[i]["MAGPMTCUMUL"] = this.achatsStats[i - 1]["MAGPMTCUMUL"] + (this.achatsStats[i]["MAGPMT"]) / totalMAGPMT
    }
  };


  loadYearStats() {
    const ets = (this.filter.ets != null) ? this.filter.ets.map(function (item) {
      return "&rs:ets=" + item.id
    }).join("") : ""
    const startDate = this.getStartDate();
    const endDate = this.getEndDate();
    const part = this.filter.part != null ? "&rs:part=" + this.filter.part.id : "";

    this.diagramIsReady = false;
    $("div#mainDiagram1").addClass('hidden');

    this.http.fetch('/v1/resources/yearStats?rs:default=' + part + ets
      + '&rs:currentPage=' + this.currentPage
      + "&rs:pageSize=" + this.config.pageSize
      + "&rs:startDate=" + startDate
      + "&rs:endDate=" + endDate
      , {
        headers: {
          'Content-Type': 'application/json'
        },
        method: 'get'
      }).then(response => response.json()).then(data => {
      var axisLabels = data.xAxis.data;
      for (var i = 0; i < axisLabels.length; i++) {
        var date = axisLabels[i];
        axisLabels[i] = date.substring(8, 10) + '/' + date.substring(5, 7) + '/' + date.substring(0, 4);
      }
      console.log.apply(console, this.logger.log(data, "Setup year chart"));
      this.diagramIsReady = true;
      $("div#mainDiagram1").removeClass('hidden');

      this.myChart = Echarts.init(this.mainDiagram1);
      this.myChart.setOption(data);
      this.myChart.resize();
      PLATFORM.global.addEventListener("resize", this.resizeEventHandler.bind(this));
    })
  };


  resizeEventHandler() {
    if (this.myChart != null && this.myChart != undefined) {
      this.myChart.resize();
    }
  };


  /* ********************************************************************************************************************* */
  /* ***************************************************** Utilities ***************************************************** */
  /* ********************************************************************************************************************* */


  sendTracking(action) {
    /*   let current = new Date()

     let pwik = "https://piwik-int.keolis.com/piwik/piwik.php?"
     pwik += "action_name=" + encodeURI(action)
     pwik +=  "&idsite=22&rec=1"
     pwik += "&r=807717"
     pwik += "&uid=" + this.currentUser
     pwik += "&h="+current.getHours()+"&m="+current.getMinutes()+"&s="+ current.getSeconds()
     pwik += "&_id=80cca9c11b29e837"
     pwik += "&send_image=0&cookie=1"
     pwik += "&url=" + encodeURI("https://10.50.138.2:8010/#/home/" + action )

     this.http.fetch(pwik, {
     headers: {

     },
     method: 'get'
     })*/
  };


  getStartDate() {
    if (this.filter.startDate != null) {
      return this.filter.startDate.year + '-' + this.filter.startDate.month + '-01';
    }
    return "";
  };


  getEndDate() {
    if (this.filter.endDate != null) {
      return this.filter.endDate.year + '-' + this.filter.endDate.month + '-' + (new Date(this.filter.endDate.year, this.filter.endDate.month, 0).getDate());
    }
    return "";
  };


  getSpacedNumber(nombre) {
    var nbrWithSpaces = nombre.toString().replace(/(\d)(?=(\d{3})+\b)/g, '$1 ');
    return nbrWithSpaces;
  };

  // Bouton d'export des données MAG pour la filiale de l'user connecté
  exportUserSubsidiaryMAGData() {
    console.log('début exécution exportUserSubsidiaryMAGData')
    var dataToStore = {};
    dataToStore.data = [];
    dataToStore.lineDelimiter = '\n';
    dataToStore.columnDelimiter = ';';
    debugger;
    var interventions = this.achatsStats;
    var storeData = {};
    this.http.fetch('/v1/resources/MAGAggregates?rs:format=csv'
      , {
        headers: {
          'Content-Type': 'application/json'
        },
        method: 'get'
      }).then(response => response.json()).then(data => {
      console.log.apply(console, this.logger.log(data, "Data achats for export loaded"));
      dataToStore.data.push(storeData);
    })
    /*  exemple
     if(interventions == null || !interventions.length) { return; }
     for(var intervention in interventions) {
     var storeData = {};
     storeData['num_intervention'] = interventions[intervention]['num_intervention'];
     storeData['date_intervention'] = interventions[intervention]['date_intervention'];
     storeData['id_piece'] = interventions[intervention]['id_piece'];
     storeData['libelle'] = interventions[intervention]['libelle'];
     storeData['quantite_piece'] = interventions[intervention]['quantite_piece'];
     storeData['prix_piece'] = interventions[intervention]['prix_piece'];
     storeData['montant_total'] = interventions[intervention]['montant_total'];
     dataToStore.data.push(storeData);
     }
     */

    var csv = this.convertArrayOfObjectsToCSV(dataToStore);
    if (csv == null) return;

    var filename = this.typeVehiculeVehicule.replace(/ /i, '_') + '_' + this.idVehicule + '.csv';
    if (!csv.match(/^data:text\/csv/i)) {
      csv = 'data:text/csv;charset=utf-8,' + csv;
    }
    var data = encodeURI(csv);
    var link = document.createElement('a');
    link.setAttribute('href', data);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  exportDatatable() {
    debugger;
    this.achatsStatsForExport = [];
    const ets = (this.filter.ets != null) ? this.filter.ets.map(function (item) {
      return "&rs:ets=" + item.id;
    }).join("") : ""
    const startDate = this.getStartDate();
    const endDate = this.getEndDate();
    const part = this.filter.part != null ? "&rs:part=" + this.filter.part.id : "";
    this.http.fetch('/v1/resources/achatsStats2?rs:default=' + part + ets
      + '&rs:currentPage=' + this.currentPage
      + "&rs:pageSize=" + this.config.pageSize
      + "&rs:startDate=" + startDate
      + "&rs:endDate=" + endDate
      + "&rs:sort=" + this.sortField
      + "&rs:minQuantity=" + 100
      , {
        headers: {
          'Content-Type': 'application/json'
        },
        method: 'get'
      }).then(response => response.json()).then(data => {
      console.log.apply(console, this.logger.log(data, "Data achats for export loaded"));
      this.achatsStatsForExport = data.results;
      var dataToStore = {};
      dataToStore.data = [];
      dataToStore.lineDelimiter = '\n';
      dataToStore.columnDelimiter = ';';

      let achats = this.achatsStatsForExport;
      if (achats == null || !achats.length) {
        return;
      }
      for (let achat in achats) {
        var storeData = {};
        storeData['Réf. Fabricant'] = achats[achat]['main.LignesCommande.RefFabricant'];
        storeData['Réf. Kapp'] = achats[achat]['main.LignesCommande.Article'];
        storeData['AvgPrixTarif'] = achats[achat]['AvgPrixTarif'];
        storeData['MAGPMC'] = achats[achat]['MAGPMC'];
        storeData['MAGPMCCUMUL'] = achats[achat]['MAGPMCCUMUL'];
        storeData['MAGPMT'] = achats[achat]['MAGPMT'];
        storeData['MAGPMTCUMUL'] = achats[achat]['MAGPMTCUMUL'];
        storeData['PMC'] = achats[achat]['PMC'];
        storeData['PMT'] = achats[achat]['PMT'];
        storeData['RatioPMCOpti'] = achats[achat]['RatioPMCOpti'];
        storeData['RatioPMTOpti'] = achats[achat]['RatioPMTOpti'];
        storeData['SomMontantCalc'] = achats[achat]['SomMontantCalc'];
        storeData['Quantité achetée'] = achats[achat]['SomQuantiteFacturee'];


        storeData['totalPMCOptiVol'] = achats[achat]['totalPMCOptiVol'];
        storeData['totalPMTOptiVol'] = achats[achat]['totalPMTOptiVol'];

        dataToStore.data.push(storeData);
      }

      var csv = this.convertArrayOfObjectsToCSV(dataToStore);
      if (csv == null) return;

      var filename = 'toto.csv';
      if (!csv.match(/^data:text\/csv/i)) {
        csv = 'data:text/csv;charset=utf-8,' + csv;
      }
      var data = encodeURI(csv);
      var link = document.createElement('a');
      link.setAttribute('href', data);
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    })
  };

  convertArrayOfObjectsToCSV(args) {
    var result, ctr, keys, columnDelimiter, lineDelimiter, data;
    data = args.data || null;
    if (data == null || !data.length) {
      return null;
    }

    columnDelimiter = args.columnDelimiter || ',';
    lineDelimiter = args.lineDelimiter || '\n';
    keys = Object.keys(data[0]);
    result = '';
    result += keys.join(columnDelimiter);
    result += lineDelimiter;

    data.forEach(function (item) {
      ctr = 0;
      keys.forEach(function (key) {
        if (ctr > 0)
          result += columnDelimiter;
        result += item[key];
        ctr++;
      });
      result += lineDelimiter;
    });
    return result;
  };

}
