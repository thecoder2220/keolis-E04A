Keolis-Prototype-reader
keolis_versailles/wcjigb

au run --watch

/v1/resources/achatsStats2?rs:default=' + part + ets
      + '&rs:currentPage=' + this.currentPage
      + "&rs:pageSize=" + this.config.pageSize
      + "&rs:startDate=" + startDate
      + "&rs:endDate=" + endDate
      + "&rs:sort=" + this.sortField
      + "&rs:minQuantity=" + 100
      
      http://localhost:9010/v1/resources/achatsStats2?rs:default=&rs:currentPage=1&rs:pageSize=100&rs:startDate=2017-07-01&rs:endDate=2018-07-31&rs:sort=MAGPMC&rs:minQuantity=0

http://localhost:9010/v1/resources/partOrderLine?rs:default=&rs:part=A9434210412&rs:ets=7804&rs:currentPage=1&rs:pageSize=100&rs:startDate=2017-07-01&rs:endDate=2018-07-31


main.LignesCommande.RefFabricant:"A6283230092"
main.LignesCommande.Article:"R001441"
AvgPrixTarif:55.9509523809525
MAGPMC:25360.12
MAGPMCCUMUL:0.0133959821477395
MAGPMT:65021.2099999999
MAGPMTCUMUL:0.0228765548022412
PMC:46.1428571428573
PMT:25.7999999999999
RatioPMCOpti:0.256235827664399
RatioPMTOpti:0.120181405895692
SomMontantCalc:119102.24
SomQuantiteFacturee:2096
totalPMCOptiVol:1496
totalPMTOptiVol:1906

Réf. Fabriquant	                              A6283230092
Réf. Kapp	                                    R001441	
Libellé	                                      COUSSIN D AIR 9
Quantité achetée	                            2096
Prix d'achat moyen (€)	
Dépenses totales (€)	
Achats optimisés (%)	
Prix crédible moyen (€)	
Manque à Gagner crédible (€)	
Cumul des Manques à Gagner crédible(%)	
Achats optimisés (%)	
Prix minimum moyen (€)	
Manque à Gagner théorique (€)	
Cumul des Manques à Gagner théorique (%)	
	


	56.82	119102	29%	46.14	25360.12	1.3 %	9%	25.80	65021.21	2.3 %


http://localhost:9010/v1/resources/yearStats?rs:default=&rs:ets=7700&rs:currentPage=1&rs:pageSize=20&rs:startDate=2017-07-01&rs:endDate=2018-07-31
