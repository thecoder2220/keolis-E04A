import {inject} from 'aurelia-framework';
import {HttpClient} from 'aurelia-fetch-client';
import {json} from 'aurelia-fetch-client';
import {bindable} from 'aurelia-framework';
import $ from 'jquery';
import * as Echarts from 'echarts';
import {EventAggregator} from 'aurelia-event-aggregator';
import {PLATFORM} from 'aurelia-pal';
import 'jstree';
import numeral from 'numeral';
import {downloadFile, formatDate} from '../../utils'

Date.prototype.addDays = function (days) {
  var date = new Date(this.valueOf());
  date.setDate(date.getDate() + days);
  return date;
}

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
  @bindable partNames = [];
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
    "endDateForGraph": {'month': '12', 'year': '2017'},
    "minQuantity": 0
  };
  @bindable preSelected = {
    "ets": [{"id": "7700", "name": "KEOLIS CIF (7700)"}],
    "part": null,
    "startDate": {'month': '01', 'year': '2017'},
    "endDate": {'month': '12', 'year': '2017'},
    "endDateForGraph": {'month': '12', 'year': '2017'},
    "minQuantity": 0
  };

  @bindable state = 0;
  achatsStatsForExport = [];
  @bindable totalMagCredible = '0';
  @bindable sumTotalExpenditure = '';
  @bindable sumMAGC = '';
  @bindable sumMAGT = '';
  /*    @bindable totalMagCredible =
   @bindable totalMagCredible =
   @bindable totalMagCredible =
   @bindable totalMagCredible =*/

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

  loadUserProfile() {
    this.http.fetch('/v1/resources/login', {
      headers: {
        'Content-Type': 'application/json'
      },
      method: 'get'
    }).then(response => response.json()).then(data => {
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
    this.currentPage = 1;
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


  // clic sur le bouton appliquer
  refresh() {
    //if (this.currentView == "Agrégée" || this.currentView == "Qualité") {
    if (this.currentView == "Pièce") {
      this.ea.publish('partChanged', {message: 'Part selection changed'});
    }
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

    // pour test => let now = new Date(2018, 0, 14);
    let now = new Date();
    let startMonth = {};
    let endMonth = {};
    let endYear = {};
    let startYear = now.getFullYear();
    const today = now.getDate();
    const currentMonth = now.getMonth();
    if (currentMonth > 2) {
      if (today < 15) {
        startMonth = now.getMonth() - 2;
      } else {
        startMonth = now.getMonth() - 1;
      }
    } else {
      if (currentMonth === 0) {
        if (today < 15) {
          startMonth = 10;
          startYear = now.getFullYear() - 1;
        } else {
          startMonth = 11;
          startYear = now.getFullYear() - 1;
        }
      } else if (currentMonth === 1) {
        if (today < 15) {
          startMonth = 11;
          startYear = now.getFullYear() - 1;
        } else {
          startMonth = 0;
        }
      }
    }
    if (startMonth === 11) {
      endMonth = 0;
      endYear = startYear + 1;
    } else {
      endMonth = startMonth + 1;
      endYear = startYear;
    }

    let startMonthString = (startMonth + 1) > 9 ? (startMonth + 1).toString() : "0".concat(startMonth + 1);
    let endMonthString = (endMonth + 1) > 9 ? (endMonth + 1).toString() : "0".concat(endMonth + 1);

    this.preSelected.startDate.year = startYear.toString();
    this.preSelected.startDate.month = startMonthString;
    this.preSelected.startDate.day = "01";
    this.preSelected.endDate.year = startYear.toString();
    this.preSelected.endDate.month = startMonthString;
    this.preSelected.endDate.day = (new Date(endYear, endMonth, 0));
    this.preSelected.endDateForGraph.year = endYear.toString();
    this.preSelected.endDateForGraph.month = endMonthString;
    this.preSelected.endDateForGraph.day = "01";
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
    this.totalMagCredible = '0';
    this.config.totalItems = 0;
    this.sumTotalExpenditure = '';
    this.sumMAGC = '';
    this.sumMAGT = '';
    const ets = (this.filter.ets != null) ? this.filter.ets.map(function (item) {
      return "&rs:ets=" + item.id;
    }).join("") : ""
    const startDate = this.getStartDateFromFilter();
    const endDate = this.getEndDateFromFilter();
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
      const firstAchatStats = this.achatsStats[0];
      let sumTotalExpenditureNumberFormat = 0;
      let sumMAGCNumberFormat = 0;
      let sumMAGTNumberFormat = 0;
      this.achatsStats.map((item) => {
        sumTotalExpenditureNumberFormat += item.SomMontantCalc;
        sumMAGCNumberFormat += item.MAGPMC;
        sumMAGTNumberFormat += item.MAGPMT;
      })
      this.sumTotalExpenditure = numeral(sumTotalExpenditureNumberFormat).format('0,0').replace(/,/g, ' ')
      this.sumMAGC = numeral(sumMAGCNumberFormat).format('0,0').replace(/,/g, ' ')
      this.sumMAGT = numeral(sumMAGTNumberFormat).format('0,0').replace(/,/g, ' ')
      const totalMagCredibleNumberFormat = firstAchatStats && firstAchatStats.MAGPMC && firstAchatStats.MAGPMCCUMUL ? (firstAchatStats.MAGPMC / firstAchatStats.MAGPMCCUMUL) : 0;
      this.totalMagCredible = numeral(totalMagCredibleNumberFormat).format('0,0').replace(/,/g, ' ')
      this.config.totalItems = data.totalItems;
      this.lastPageNumber = Math.ceil(data.totalItems / this.config.pageSize);
      //this.processSumGAP()
      this.loadPartsNames(this.achatsStats, "main.LignesCommande.RefFabricant").then(response => {
        this.partNames = response;
        this.achatsStatsReady = true;
      })
      if (this.currentView == "Qualité") {
        this.loadQualityStats();
      }
    })
  };


  loadQualityStats() {
    this.achatsQualiteStats = [];
    this.achatsQualiteStatsReady = false;
    this.sumTotalExpenditure = '';
    this.sumMAGC = '';
    this.sumMAGT = '';
    let parts = {
      parts: this.achatsStats.map(function (item) {
        return item["main.LignesCommande.RefFabricant"]
      })
    };
    const ets = (this.filter.ets != null) ? this.filter.ets.map(function (item) {
      return "&rs:ets=" + item.id
    }).join("") : ""
    const startDate = this.getStartDateFromFilter();
    const endDate = this.getEndDateFromFilter();
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
      let sumTotalExpenditureNumberFormat = 0;
      let sumMAGCNumberFormat = 0;
      let sumMAGTNumberFormat = 0;
      for (let achat in this.achatsStats) {

        let refFabricant = this.achatsStats[achat]['main.LignesCommande.RefFabricant'];
        let refArticle = this.achatsStats[achat]['main.LignesCommande.Article'];
        if (this.achatsQualiteStats [refFabricant] && this.showQualityLine(this.achatsStats[achat], this.achatsQualiteStats)) {
          let qualiteForExport = this.achatsQualiteStats [refFabricant][refArticle];

          if (qualiteForExport) {
            let label = this.partNames[refFabricant];

            if (label) {
              sumTotalExpenditureNumberFormat += this.achatsStats[achat]['SomMontantCalc'];
            }
          }
        }
      }
      this.sumTotalExpenditure = numeral(sumTotalExpenditureNumberFormat).format('0,0').replace(/,/g, ' ')
      for (let achat of this.achatsStats) {
        achat.showQuality = this.showQualityLine(achat, this.achatsQualiteStats);
      }
      this.achatsQualiteStatsReady = true;
    })
  };


  setSortField(field) {
    let reload = (field != this.sortField) ? true : false;
    this.sortField = field;
    if (reload) this.loadAchatsStats();
  };


  showQualityLine(achat, achatsQualiteStats) {
    if (achat != null && achatsQualiteStats != null) {
      var moreThanTwenty = 0;
      var qualities = achatsQualiteStats[achat["main.LignesCommande.RefFabricant"]][achat["main.LignesCommande.Article"]];
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


  loadPartsNames(source, reference) {
    let query = {
      "parts": source.map(function (item) {
        return item[reference]
      })
    }

    return this.http.fetch('/v1/resources/partName', {
      headers: {
        'Content-Type': 'application/json'
      },
      method: 'post',
      body: json(query)
    }).then(response => response.json()).then(data => {
      console.log.apply(console, this.logger.log(data, "Data part names loaded"));
      return data;
    })
  };

  loadPartsNamesWithDirectReference(directReference) {
    let query = {
      "parts": Object.keys(directReference)
    }

    return this.http.fetch('/v1/resources/partName', {
      headers: {
        'Content-Type': 'application/json'
      },
      method: 'post',
      body: json(query)
    }).then(response => response.json()).then(data => {
      console.log.apply(console, this.logger.log(data, "Data part names loaded"));
      return data;
    })
  };

  loadParts(filter, limit) {
    let toto = '/v1/resources/part?rs:filter=' + filter;
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
      this.currentSuggestionLabel = "Libellé ou Réf. Fabricant ou Réf. Kapp de la pièce";
      this.currentSuggestionTitle = "Pièce(s)";
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
      'id': '170',
      'text': 'Toutes les filiales',
      'state': {'opened': true, 'selected': false},
      'children': myData
    };
    me.initMultiSelectTree(myData, me);
  };


  initMultiSelectTree(myData, me) {

    var preSelectedEts = [];
    this.preSelected.ets.map((item) => {
      preSelectedEts.push(item.id);  // 7804 normalement pour versailles
    })
    if (preSelectedEts.length == 0) {
      preSelectedEts = ['170'];  // Toutes les filiales
    }
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

    $('#multiselectTreeFiliale').on('loaded.jstree', function () {
      $("#multiselectTreeFiliale").jstree().select_node(preSelectedEts)
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
  }

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
    const startDate = this.getStartDateFromFilter();
    const endDate = this.getEndDateFromFilter();
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
    const startDate = this.getStartDateFromFilter();
    const endDate = this.getEndDateFromFilterForGraph();
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
      //console.log.apply(console, this.logger.log(data, "Setup year chart"));
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


  getStartDateFromFilter() {
    if (this.filter.startDate != null) {
      return this.filter.startDate.year + '-' + this.filter.startDate.month + '-01';
    }
    return "";
  };


  getEndDateFromFilter() {
    if (this.filter.endDate != null) {
      return this.filter.endDate.year + '-' + this.filter.endDate.month + '-' + (new Date(this.filter.endDate.year, this.filter.endDate.month, 0).getDate());
    }
    return "";
  };

  getEndDateFromFilterForGraph() {
    if (this.filter.endDate != null) {
      const lastDayOfFilterDate = new Date(this.filter.endDate.year, this.filter.endDate.month, 0);
      const nextDay = lastDayOfFilterDate.addDays(1);
      return formatDate(nextDay);
    }
    else
      return "";
  };

  getSpacedNumber(nombre) {
    var nbrWithSpaces = nombre.toString().replace(/(\d)(?=(\d{3})+\b)/g, '$1 ');
    return nbrWithSpaces;
  };

  // Bouton d'export des données MAG pour la filiale de l'user connecté
  exportUserSubsidiaryMAGData() {
    var dataToStore = {};
    dataToStore.data = [];
    dataToStore.lineDelimiter = '\n';
    dataToStore.columnDelimiter = ';';
    this.http.fetch('/v1/resources/MAGAggregates?rs:format=csv'
      , {
        headers: {
          'Content-Type': 'text/plain;charset=UTF-8'
        },
        method: 'get'
      }).then(response => response.text()).then(csvdata => {
      if (csvdata == null) return;
      let filename = (this.preSelected.ets !== undefined && this.preSelected.ets !== null) ? 'Analyse MAG - ' + this.preSelected.ets[0].name + '.csv' : 'Analyse MAG.csv'
      if (!csvdata.match(/^data:text\/csv/i)) {
        csvdata = 'data:text/csv;charset=utf-8,' + '\ufeff' + csvdata.replace(new RegExp(',', 'g'), ';');
      }
      var link = document.createElement('a');
      link.setAttribute('href', csvdata);
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    })
  };


  exportDatatable() {
    const ets = (this.filter.ets != null) ? this.filter.ets.map(function (item) {
      return "&rs:ets=" + item.id;
    }).join("") : ""
    const startDate = this.getStartDateFromFilter();
    const endDate = this.getEndDateFromFilter();
    const part = this.filter.part != null ? "&rs:part=" + this.filter.part.id : "";
    var dataToStore = {};
    dataToStore.data = [];
    dataToStore.lineDelimiter = '\n';
    dataToStore.columnDelimiter = ';';
    if (this.currentView === 'Agrégée') {
      this.achatsStatsForExport = [];
      this.http.fetch('/v1/resources/achatsStats2?rs:default=' + part + ets
        + '&rs:currentPage=' + 1
        + "&rs:pageSize=" + 100
        + "&rs:startDate=" + startDate
        + "&rs:endDate=" + endDate
        + "&rs:sort=" + this.sortField
        + "&rs:minQuantity=" + this.filter.minQuantity
        , {
          headers: {
            'Content-Type': 'application/json;charset=utf-8'
          },
          method: 'get'
        }).then(response => response.json()).then(data => {
        //console.log.apply(console, this.logger.log(data, "Data achats for export loaded"));
        this.achatsStatsForExport = data.results;
        this.loadPartsNames(this.achatsStatsForExport, "main.LignesCommande.RefFabricant").then(labels => {
          this.partNames = labels;
          let achats = this.achatsStatsForExport;
          if (achats == null || !achats.length) {
            return;
          }
          for (let achat in achats) {
            let refFabricant = achats[achat]['main.LignesCommande.RefFabricant'];
            let label = this.partNames[refFabricant];
            if ((label !== undefined) && (label !== null)) {
              let storeData = {};
              storeData['Réf. Fabricant'] = refFabricant;
              storeData['Réf. Kapp'] = achats[achat]['main.LignesCommande.Article'];
              storeData['Libellé'] = label.substring(0, 15).replace(new RegExp('\"', 'g'), '');
              storeData['Quantité achetée'] = achats[achat]['SomQuantiteFacturee'];
              storeData['Prix d\'achat moyen'] = numeral(achats[achat]['SomMontantCalc'] / achats[achat]['SomQuantiteFacturee']).format('0.00');
              storeData['Dépenses totales'] = numeral(achats[achat]['SomMontantCalc']).format('(0)');
              storeData['Achats optimisés'] = numeral((1 - achats[achat]["totalPMCOptiVol"] / achats[achat]["SomQuantiteFacturee"])).format('0 %');
              storeData['Prix crédible moyen'] = numeral(achats[achat]["PMC"]).format('0.0)');
              storeData['Manque à Gagner crédible'] = numeral(achats[achat]["MAGPMC"]).format('0.0)');
              storeData['Cumul des Manques à Gagner crédible'] = numeral(achats[achat]["MAGPMCCUMUL"]).format('(0.0 %)');
              storeData['MAG Achats optimisés'] = numeral((1 - achats[achat]["totalPMTOptiVol"] / achats[achat]["SomQuantiteFacturee"])).format('0 %');
              storeData['Prix minimum moyen'] = numeral(achats[achat]["PMT"]).format('0.0)');
              storeData['Manque à Gagner théorique'] = numeral(achats[achat]["MAGPMT"]).format('0.0)');
              storeData['Cumul des Manques à Gagner théorique'] = numeral(achats[achat]["MAGPMTCUMUL"]).format('(0.0 %)');
              dataToStore.data.push(storeData);
            }
          }
          downloadFile(dataToStore, 'Analyse par pièce - Vue Agrégée.csv');
        })

      })
    } else if (this.currentView === 'Qualité') {
      
      let parts = {
        parts: this.achatsStats.map(function (item) {
          return item["main.LignesCommande.RefFabricant"]
        })
      };

      var achatsStatsForExportCsvFromQualiteView = [];
      var qualiteStats = [];
      this.http.fetch('/v1/resources/achatsStats2?rs:default=' + part + ets
        + '&rs:currentPage=' + 1
        + "&rs:pageSize=" + 100
        + "&rs:startDate=" + startDate
        + "&rs:endDate=" + endDate
        + "&rs:sort=" + this.sortField
        + "&rs:minQuantity=" + this.filter.minQuantity
        , {
          headers: {
            'Content-Type': 'application/json;charset=utf-8'
          },
          method: 'get'
        }).then(response => response.json()).then(data => {// ok
        achatsStatsForExportCsvFromQualiteView = data.results;
        this.loadPartsNames(achatsStatsForExportCsvFromQualiteView, "main.LignesCommande.RefFabricant").then(labels => {
          this.partNames = labels;
          let achats = achatsStatsForExportCsvFromQualiteView;
          if (achats == null || !achats.length) {
            return;
          }
          this.http.fetch('/v1/resources/qualityStats?rs:part=' + ets
            + '&rs:currentPage=' + 1
            + "&rs:pageSize=" + 100
            + "&rs:startDate=" + startDate
            + "&rs:endDate=" + endDate
            , {
              headers: {
                'Content-Type': 'application/json'
              },
              method: 'post'
              ,
              body: json(parts)
            }).then(qualityResponse => qualityResponse.json()).then(qualityData => {
            qualiteStats = qualityData;
            if (!qualiteStats) {
              return;
            }
            for (let achat in achats) {
              let refFabricant = achats[achat]['main.LignesCommande.RefFabricant'];
              let refArticle = achats[achat]['main.LignesCommande.Article'];
              if (qualiteStats[refFabricant] && this.showQualityLine(achats[achat], qualiteStats)) {
                let qualiteForExport = qualiteStats[refFabricant][refArticle];

                if (qualiteForExport) {
                  let label = this.partNames[refFabricant];

                  if (label) {
                    var storeData = {};
                    storeData['Réf. Fabricant'] = refFabricant;
                    storeData['Réf. Kapp'] = achats[achat]['main.LignesCommande.Article'];
                    storeData['Libellé'] = label.substring(0, 15).replace(new RegExp('\"', 'g'), '');
                    storeData['Quantité achetée'] = achats[achat]['SomQuantiteFacturee'];
                    storeData['Prix d\'achat moyen'] = numeral(achats[achat]['SomMontantCalc'] / achats[achat]['SomQuantiteFacturee']).format('0.00');
                    storeData['Dépenses totales'] = numeral(achats[achat]['SomMontantCalc']).format('(0)');

                    let ori = qualiteForExport['ORI'];
                    storeData['ORI / Quantité commandée'] = ori ? numeral(ori['SomQuantiteFacturee'] / achats[achat]['SomQuantiteFacturee']).format('(0.0 %)') : '0.0 %';
                    storeData['ORI / Prix d\'achat moyen'] = ori ? numeral(ori['AvgPrixTarif']).format('0.0') : '0.0';
                    let orf = qualiteForExport['ORF'];
                    storeData['ORF / Quantité commandée'] = orf ? numeral(orf['SomQuantiteFacturee'] / achats[achat]['SomQuantiteFacturee']).format('(0.0 %)') : '0.0 %';
                    storeData['ORF / Prix d\'achat moyen'] = orf ? numeral(orf['AvgPrixTarif']).format('0.0') : '0.0';
                    let pqe = qualiteForExport['PQE'];
                    storeData['PQE / Quantité commandée'] = pqe ? numeral(pqe['SomQuantiteFacturee'] / achats[achat]['SomQuantiteFacturee']).format('(0.0 %)') : '0.0 %';
                    storeData['PQE / Prix d\'achat moyen'] = pqe ? numeral(pqe['AvgPrixTarif']).format('0.0') : '0.0';
                    dataToStore.data.push(storeData);
                  }
                }
              }
            } // boucle for achats
            downloadFile(dataToStore, 'Analyse par pièce - Vue Qualité.csv');
          })
        })
      })
    } // } else if (this.currentView === 'Qualité') {
  } // fin exportDatatable
}  // fin class
