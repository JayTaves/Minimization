var arrToCSV, download, Group, generateVariates;

arrToCSV = function (arrs) {
    var csv = "";

    for (var i = 0; i < arrs.length; i++) {
        for (var j = 0; j < arrs[i].length; j++) {
            csv += '"' + arrs[i][j].toString() + '",';
        }
        csv = csv.substr(0, csv.length - 1) + "\n";
    }

    return csv;
};

download = function(filename, text) {
    // http://stackoverflow.com/a/18197341
    var element = document.createElement('a');

    element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename + ".csv");

    element.style.display = 'none';
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
};

generateVariates = function () {

};

Group = function (name) {
    this.name = name;
    this.patients = [];
    this.investigators = [];

    this.characteristics = {
        Male: {count: 0, elem: this.table.children(".male")},
        Female: {count: 0, elem: this.table.children(".female")},
        Young: {count: 0, elem: this.table.children(".young")},
        Middle: {count: 0, elem: this.table.children(".middle")},
        Old: {count: 0, elem: this.table.children(".old")},
        Low: {count: 0, elem: this.table.children(".low")},
        High: { count: 0, elem: this.table.children(".high")}
    };

    this.addPatient = function (patient) {
        this.patients.push(patient);
        this.characteristics[patient.gender.text].count += 1;
        this.characteristics[patient.age.text].count += 1;
        this.characteristics[patient.risk.text].count += 1;
        this.investigators[patient.investigator - 1].count += 1;
        return this;
    };
};