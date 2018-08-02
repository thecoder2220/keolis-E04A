export const convertArrayOfObjectsToCSV = (args) => {
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
}


export const downloadCsvFile = (dataToStore, filename = 'export.csv') => {
  var csv = convertArrayOfObjectsToCSV(dataToStore);
  if (csv == null) return;
  if (!csv.match(/^data:text\/csv/i)) {
    csv = 'data:text/csv;charset=utf-8,' + '\ufeff' + csv;
  }
  let data = encodeURI(csv);
  // new Blob(['\ufeff' + content]
  let link = document.createElement('a');
  link.setAttribute('href', data);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

    /* le code suivant  marche
    var CSV = [
    '"1","val1","val2","val3","val4"',
    '"2","val1","val2","val3","val4"',
    '"3","val1","val2","val3","val4"'
  ].join('\n');

  var csvFile = new Blob([CSV], {type: 'text/csv'});
  var a = document.createElement('a');
  a.download = 'my.csv';
  a.href = window.URL.createObjectURL(csvFile);
  */
}

export const formatDate =  (date) => {
  var d = new Date(date),
    month = '' + (d.getMonth() + 1),
    day = '' + d.getDate(),
    year = d.getFullYear();

  if (month.length < 2) month = '0' + month;
  if (day.length < 2) day = '0' + day;

  return [year, month, day].join('-');
}

//export const adding=(a, b) => { return a + b; }

export const upload = () => {

}
