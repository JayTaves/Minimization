var arrToCSV, download, Patient, generateVariates, categories;

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

generateVariates = function (numVariates, numCategories, distribution, varNames, catNames) {
    var variates, index, categories, catLength, len, cat, count, currentCat;

    variates = [];
    categories = [];

    catLength = Math.ceil(numVariates / numCategories);

    // Make sure distribution matches numVariates
    if (distribution !== undefined) {
        if (distribution.length !== numCategories) {
            console.error("Distribution had length " + distribution.length +
                " but the number of categories was specified as " + numCategories);
        }

        count = 0;

        for (index = 0; index < distribution.length; index++) {
            count += distribution[index];
        }

        if (count !== numVariates) {
            console.error("Distribution had " + count + " variates but numVariates set to " +
                numVariates);
        }
    }

    for (index = 0; index < numCategories; index++) {
        if (distribution === undefined) {
            len = index === numCategories - 1 ?
                numVariates - catLength * (numCategories - 1) : catLength;
        } else {
            len = distribution[index];
        }

        categories[index] = {
            name : catNames[index] === undefined ? "Category " + index : catNames[index],
            length : len,
            variates : []
        };
    }

    // Keeps track of which category we are on
    currentCat = 0;

    for (index = 0; index < numVariates; index++) {
        if (distribution === undefined) {
            cat = categories[Math.floor(index / catLength)];
        } else {
            distribution[0]--;
            cat = categories[currentCat];

            if (distribution[0] === 0) {
                currentCat++;
                distribution = distribution.reverse();
                distribution.pop();
                distribution = distribution.reverse();
            }
        }

        variates[index] = {
            id : index,
            name : varNames[index] === undefined ? "Variate " + index : varNames[index],
            count : 0,
            category : cat
        };

        cat.variates.push(variates[index]);
    }

    return {
        categories : categories,
        variates : variates
    };
};

Patient = function (id, categories) {
    this.id = id;
    this.categories = categories.categories;
    this.variates = categories.variates;

    this.properties = [];

    this.generateProperties = function () {
        var index, cat, variate;

        for (index = 0; index < this.categories.length; index++) {
            cat = this.categories[index];

            variate = cat.variates[Math.floor(Math.random() * cat.length)];
            this.properties[variate.id] = 1;
        }
    };

    this.printProperties = function () {
        var index, str, cat, variate;

        str = "";

        for (index = 0; index < this.properties.length; index++) {
            if (this.properties[index] !== undefined) {
                variate = this.variates[index];
                cat = variate.category;

                str += cat.name + ": " + variate.name + ", ";
            }
        }

        str = str.substring(0, str.length - 1);

        return str;
    };
};

$(document).ready(function () {
    var pat;

    categories = generateVariates(7, 3, [2, 3, 2],
        ["Male", "Female", "Young", "Middle", "Old", "Low", "High"],
        ["Gender", "Age", "Risk"]);

    pat = new Patient(0, categories);
    pat.generateProperties();
    console.log(pat.printProperties());
});