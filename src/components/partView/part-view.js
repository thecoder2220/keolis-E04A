import {inject} from 'aurelia-framework';
import {HttpClient} from 'aurelia-fetch-client';
import {json} from 'aurelia-fetch-client';
import {bindable} from 'aurelia-framework';
import {observable} from 'aurelia-framework';
import * as Echarts from 'echarts'
import {EventAggregator} from 'aurelia-event-aggregator';
import {PLATFORM} from 'aurelia-pal';
import 'jquery-ui';
import {downloadFile} from '../../utils'
import numeral from 'numeral';

@inject(HttpClient, Echarts, EventAggregator)
export class PartView {
  http = null;
  position = 'top';
  trigger = 'mouseover';
  facets = {};
  priceTypes = [
    {id: "T", name: 'Théorique'},
    {id: "C", name: 'Crédible'}
  ];

  @bindable fournisseurIsReady = true;
  @bindable orderLinesReady = true;
  @bindable etsNames = {};
  @bindable etablissements = {};
  @bindable achatsStats;
  @bindable topBuyers = {};
  @bindable orderLines;
  @bindable catalogEntries = [];
  @bindable fournisseurs;
  @bindable credibles = null;
  @bindable currentPage = 1;
  @bindable config = {
    pageSize: 20,
    totalItems: 0,
    etablissement: ""
  };
  @bindable priceType = "T";

  @bindable filter;
  @bindable part;
  orderLinesForExport = [];
  URIs=[];
  @bindable P_URI="";
  @bindable PMC_URI="";
  @bindable PMT_URI="";

  /* ******************************************************************************************************************* */
  /* ***************************************************** General ***************************************************** */
  /* ******************************************************************************************************************* */


  constructor(http, Echarts, EventAggregator) {
    var logger = require('../log/logger');
    this.logger = logger;
    http.configure(config => {
      // config.withBaseUrl('');
      //config.useStandardConfiguration();
      config.withDefaults({
        credentials: 'include' // Valid values; omit, same-origin and include
      });
    });
    this.http = http;
    this.echarts = Echarts;
    this.ea = EventAggregator;
    let subscription = this.ea.subscribe('partChanged', response => {
      this.partHasChanged(null, null)
    });
  };


  attached() {
    $('.modal').modal({keyboard: false, show: false});
    // Jquery draggable
    $('.modal-dialog').draggable({
      handle: ".modal-header"
    });
    console.log.apply(console, this.logger.log(null, "DOM part loaded"));
  };


  partHasChanged(newValue, oldValue) {
    this.resizeEventHandler();
    this.loadPArtOrderLines();
    this.loadFournisseurStats();
  };


  /* ******************************************************************************************************************* */
  /* ***************************************************** Tableau ***************************************************** */
  /* ******************************************************************************************************************* */


  loadPArtOrderLines() {
    var ets = (this.filter.ets != null) ? this.filter.ets.map(function (item) {
      return "&rs:ets=" + item.id
    }).join("") : ""
    const startDate = this.getStartDate();
    const endDate = this.getEndDate();
    const part = this.filter.part != null ? "&rs:part=" + this.filter.part.id : "";
    this.orderLines = [];
    this.orderLinesReady = false;

    this.http.fetch('/v1/resources/partOrderLine?rs:default=' + part + ets + '&rs:currentPage=' + this.currentPage + "&rs:pageSize=" + this.config.pageSize
      + "&rs:startDate=" + startDate
      + "&rs:endDate=" + endDate
      , {
        headers: {
          'Content-Type': 'application/json'
        },
        method: 'get'
      }).then(response => response.json()).then(data => {
      console.log.apply(console, this.logger.log(data, "Data order lines loaded"));
      this.orderLines = data.results;
      this.orderLinesReady = true;
      this.config.totalItems = data.totalItems;
      this.orderLines.map( (item) => {
        debugger
        this.URIs.push({catalogId:item.DCRSALCA_norm+item.RFBSALCA+item.PVFSALCA, P_URI: item.P_URI,PMC_URI: item.PMC_URI,  PMT_URI: item.PMT_URI});
      })

      this.loadFournisseurNames(this.orderLines).then(providers => {
        this.fournisseurs = providers;
        this.getCurrentETSNames();
      })
    })
  };

  getCurrentETSNames() {
    let query = {
      "ets": this.orderLines.map(function (item) {
        return item.ETSSALCA
      })
    }

    this.http.fetch('/v1/resources/etablissement',
      {
        headers: {
          'Content-Type': 'application/json'
        },
        method: 'post',
        body: json(query)
      }).then(response => response.json()).then(data => {
      console.log.apply(console, this.logger.log(data, "Data filiales names loaded"));
      data.forEach(function (item) {
        this.etablissements[item.id] = item
      }.bind(this));
    })
  };


  setPage(num) {
    if (this.currentPage + num >= 1) this.currentPage += num;
  };


  currentPageChanged(newValue, oldValue) {
    if (newValue != oldValue) this.loadPArtOrderLines()
  };


  /* ******************************************************************************************************************* */
  /* **************************************************** Catalogue **************************************************** */
  /* ******************************************************************************************************************* */


  loadCatalogEntries(orderDate, part, maxPrice) {  //orderDate="2018-05-17" //part="A0004295695"  //maxPrice="22"
  debugger
    for (let piece of this.URIs) {
      if(piece.catalogId===orderDate+part+maxPrice) {
        this.P_URI = piece.P_URI;
        this.PMC_URI = piece.PMC_URI;
        this.PMT_URI = piece.PMT_URI;
        break;
      }
    }
    this.http.fetch('/v1/resources/catalog?rs:PART=' + part    // part = A0004295695
      + '&rs:orderDate=' + orderDate
      + '&rs:currentPage=' + this.currentPage
      + "&rs:pageSize=" + this.config.pageSize +
      "&rs:maxPrice=" + maxPrice,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        method: 'get'
      }).then(response => response.json()).then(data => {
      console.log.apply(console, this.logger.log(data, "Data catalogue loaded"));
      this.catalogEntries = data;
      this.catalogEntries.map( (entry) => {
        if (entry.uri===this.P_URI){
          Object.assign(entry, {'cellCSS': 'table-info'})
        } else if (entry.P_URI===this.P_URI){
          Object.assign(entry, {'cellCSS': 'table-warning'})
        } else if (entry.P_URI===this.P_URI){
          Object.assign(entry, {'cellCSS': 'table-danger'})
        }
      })

      this.loadCredibles(orderDate, part);
      this.loadFournisseurNames(this.orderLines).then(providers => {
        this.fournisseurs = providers;
        for (var entry of this.catalogEntries) {
          this.loadTopThree(orderDate, part, entry.GRPSBART)
        }
      })


    })
  };


  getTopThreeNames(buyers) {
    if (buyers)
      return buyers.map(function (item) {
        return item.EtablissementName
      }).join(" ; ")
  };


  loadTopThree(orderDate, part, grp) {
    this.http.fetch('/v1/resources/catalogTopBuyers?rs:grp=' + grp
      + '&rs:PART=' + part
      + '&rs:orderDate=' + orderDate
      + '&rs:currentPage=' + this.currentPage
      + "&rs:pageSize=" + this.config.pageSize,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        method: 'get'
      }).then(response => response.json()).then(data => {
      console.log.apply(console, this.logger.log(data, "Data top three buyers loaded"));
      this.topBuyers[grp] = data
    })
  };

  loadCredibles(orderDate, part) {
    this.http.fetch('/v1/resources/credible?rs:orderDate=' + orderDate + '&rs:PART=' + part, {
      headers: {
        'Content-Type': 'application/json'
      },
      method: 'get'
    }).then(response => response.json()).then(data => {
      console.log.apply(console, this.logger.log(data, "Data order date loaded"));
      this.credibles = data;
    })
  };


  /* ******************************************************************************************************************* */
  /* ****************************************************** Graph ****************************************************** */
  /* ******************************************************************************************************************* */


  loadFournisseurStats() {
    var ets = (this.filter.ets != null) ? this.filter.ets.map(function (item) {
      return "&rs:ets=" + item.id
    }).join("") : ""
    const startDate = this.getStartDate();
    const endDate = this.getEndDate();
    const part = this.filter.part != null ? "&rs:part=" + this.filter.part.id : "";
    this.fournisseurIsReady = false;
    $("div#fournisseurDiagram").addClass('hidden');

    this.http.fetch('/v1/resources/fournisseurStats?rs:default=' + part + ets + '&rs:currentPage=' + this.currentPage + "&rs:pageSize=" + this.config.pageSize
      + "&rs:startDate=" + startDate
      + "&rs:endDate=" + endDate
      , {
        headers: {
          'Content-Type': 'application/json'
        },
        method: 'get'
      }).then(response => response.json()).then(data => {
      this.fournisseurIsReady = true;
      $("div#fournisseurDiagram").removeClass('hidden');

      this.myChart = Echarts.init(this.fournisseurDiagram);
      console.log.apply(console, this.logger.log(data, "Setup piece chart"));
      this.myChart.setOption(data);
      this.resizeEventHandler()
      PLATFORM.global.addEventListener("resize", this.resizeEventHandler.bind(this));
    })
  };


  resizeEventHandler() {
    if (this.myChart != null && this.myChart != undefined) {
      this.myChart.resize();
    }
  };


  /* ******************************************************************************************************************* */
  /* **************************************************** Utilities **************************************************** */
  /* ******************************************************************************************************************* */


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

  exportOrderDetails() {
    var ets = (this.filter.ets != null) ? this.filter.ets.map(function (item) {
      return "&rs:ets=" + item.id
    }).join("") : ""
    const startDate = this.getStartDate();
    const endDate = this.getEndDate();
    const part = this.filter.part != null ? "&rs:part=" + this.filter.part.id : "";
    this.orderLinesForExport = [];
    this.http.fetch('/v1/resources/partOrderLine?rs:default=' + part + ets + '&rs:currentPage=' + 1 + "&rs:pageSize=" + 100
      + "&rs:startDate=" + startDate
      + "&rs:endDate=" + endDate
      , {
        headers: {
          'Content-Type': 'application/json'
        },
        method: 'get'
      }).then(response => response.json()).then(data => {
      console.log.apply(console, this.logger.log(data, "Data orderLines for export loaded"));
      this.orderLinesForExport = data.results;
      this.loadFournisseurNames(this.orderLinesForExport).then(providers => {
        this.fournisseurs = providers;
        this.getCurrentETSNames();
        var dataToStore = {};
        dataToStore.data = [];
        dataToStore.lineDelimiter = '\n';
        dataToStore.columnDelimiter = ';';
        let orders = this.orderLinesForExport;
        if (orders == null || !orders.length) {
          return;
        }
        for (let order in orders) {
          let storeData = {};

          storeData['Date'] = orders[order]['DCRSALCA_norm'];
          let etssalca = this.etablissements[orders[order]['ETSSALCA']];
          storeData['Filiale'] = etssalca !== null && etssalca !== undefined ? etssalca.name : '';
          storeData['Référence commande'] = orders[order]['NUISALCA'];
          storeData['Quantité'] = orders[order]['QTFSALCA_norm'];
          storeData['Fournisseur'] = this.fournisseurs[orders[order]['catalog']['P_URI']['FOUSBART']];
          storeData['Constructeur'] = this.fournisseurs[orders[order]['catalog']['P_URI']['TFASBART']] + ' ' + orders[order]['catalog']['P_URI']['TFASBART'];
          let keoEquip = orders[order]['catalog']['P_URI']['Properties']['KEO_EQUIP'];
          storeData['Equipementier'] = (keoEquip !== undefined && keoEquip !== null) ? keoEquip['VALSBAAA'] : '';
          storeData['Référence fournisseur'] = orders[order]['catalog']['P_URI']['REFSBART'];
          storeData['Prix'] = orders[order]['PVFSALCA'];
          storeData['Délai (jours)'] = orders[order]['catalog']['P_URI']['DLVSBART'];
          storeData['Qualité'] = orders[order]['catalog']['P_URI']['Properties']['KEO_PIECO'] !== null ? orders[order]['catalog']['P_URI']['Properties']['KEO_PIECO']['VALSBAAA'] : 'Inconnue';
          storeData['Manque à gagner'] = '';
          dataToStore.data.push(storeData);

          storeData = {};
          storeData['Date'] = '';
          storeData['Filiale'] = 'Prix spécifique';
          storeData['Référence commande'] = '';
          storeData['Quantité'] = '';
          storeData['Fournisseur'] = this.fournisseurs[orders[order]['catalog']['P_PMC']['FOUSBART']];
          storeData['Constructeur'] = this.fournisseurs[orders[order]['catalog']['P_URI']['TFASBART']] + ' ' + orders[order]['catalog']['P_URI']['TFASBART'];
          let keoEquipPS = orders[order]['catalog']['P_PMC']['Properties']['KEO_EQUIP'];
          storeData['Equipementier'] = (keoEquipPS !== undefined && keoEquipPS !== null) ? keoEquipPS['VALSBAAA'] : '';
          storeData['Référence fournisseur'] = orders[order]['catalog']['P_PMC']['REFSBART'];
          storeData['Prix'] = numeral(orders[order]['PMC']).format('0.0)');
          storeData['Délai (jours)'] = orders[order]['catalog']['P_PMC']['DLVSBART'];

          storeData['Qualité'] = orders[order]['catalog']['P_PMC']['Properties']['KEO_PIECO'] !== null ? orders[order]['catalog']['P_PMC']['Properties']['KEO_PIECO']['VALSBAAA'] : 'Inconnue';
          storeData['Manque à gagner'] = numeral(orders[order]['PMC_MT']).format('0.0)');
          dataToStore.data.push(storeData);

          storeData = {};
          storeData['Date'] = '';
          storeData['Filiale'] = 'Prix Minimal';
          storeData['Référence commande'] = '';
          storeData['Quantité'] = '';
          storeData['Fournisseur'] = this.fournisseurs[orders[order]['catalog']['P_PMT']['FOUSBART']];
          storeData['Constructeur'] = this.fournisseurs[orders[order]['catalog']['P_PMT']['TFASBART']] + ' ' + orders[order]['catalog']['P_PMT']['TFASBART'];
          let keoEquipPM = orders[order]['catalog']['P_PMT']['Properties']['KEO_EQUIP'];
          storeData['Equipementier'] = (keoEquipPM !== undefined && keoEquipPM !== null) ? keoEquipPM['VALSBAAA'] : '';
          storeData['Référence fournisseur'] = orders[order]['catalog']['P_PMT']['REFSBART'];
          storeData['Prix'] = numeral(orders[order]['PMT']).format('0.0)');
          storeData['Délai (jours)'] = orders[order]['catalog']['P_PMT']['DLVSBART'];

          storeData['Qualité'] = orders[order]['catalog']['P_PMT']['Properties']['KEO_PIECO'] !== null ? orders[order]['catalog']['P_PMC']['Properties']['KEO_PIECO']['VALSBAAA'] : 'Inconnue';
          storeData['Manque à gagner'] = numeral(orders[order]['PMT_MT']).format('0.0)');
          dataToStore.data.push(storeData);

        }
        downloadFile(dataToStore, 'Détails des commandes.csv');
      })
    })
  }

  loadFournisseurNames(orderLines) {
    let references = this.catalogEntries.map(function (item) {
      return item.FOUSBART
    })
    orderLines.forEach(function (item) {
      references.push(item["FOU"]);
      if (item["catalog"]["P_PMT"] != null) references.push(item["catalog"]["P_PMT"]["GRPSBART"]);
      if (item["catalog"]["P_PMC"] != null) references.push(item["catalog"]["P_PMC"]["GRPSBART"]);
      if (item["catalog"]["P_PMT"] != null) references.push(item["catalog"]["P_PMT"]["TFASBART"]);
      if (item["catalog"]["P_PMC"] != null) references.push(item["catalog"]["P_PMC"]["TFASBART"]);
      if (item["catalog"]["P_URI"] != null) references.push(item["catalog"]["P_URI"]["TFASBART"]);
      if (item["catalog"]["P_URI"] != null) references.push(item["catalog"]["P_URI"]["GRPSBART"]);
    })

    let query = {
      "fournisseurs": references
    }

    return this.http.fetch('/v1/resources/fournisseur', {
      headers: {
        'Content-Type': 'application/json'
      },
      method: 'post',
      body: json(query)
    }).then(response => response.json()).then(data => {
      console.log.apply(console, this.logger.log(data, "Data fournisseurs loaded"));
      //this.fournisseurs = data;
      return data;
    })
  };

}
