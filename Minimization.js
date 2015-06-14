var currentStudy_, investigatorBlock, numInvestigators, Investigator, Study, Group, Patient, patientTypes, allInvestigators, stratRandom;

currentStudy_ = undefined;

investigatorBlock =	function (number) {
		return	"<div class='strategy'>" +
					"<a>Investigator " + number + "</a>" +
					"<br />" +
					"<input name='gator" + number + "' type='radio' value='normal' />Normal" +
					"<br />" +
					"<input name='gator" + number + "' type='radio' value='computer' />Cheat (computer): patient" +
					"<select name='computergator" + number + "' >" +
						"<option selected='selected'>1</option>" +
						"<option>2</option>" +
						"<option>3</option>" +
						"<option>4</option>" +
						"<option>5</option>" +
						"<option>6</option>" +
						"<option>7</option>" +
						"<option>8</option>" +
						"<option>9</option>" +
						"<option>10</option>" +
						"<option>11</option>" +
						"<option>12</option>" +
					"</select>" +
					"into the " +
					"<select name='computergroupgator" + number + "' >" +
						"<option selected='selected' value='treatment'>Treatment</option>" +
						"<option value='control'>Control</option>" +
					"</select>" +
					"group." +
					"<br />" +
					"<input name='gator" + number + "' type='radio' value='player' checked/>Cheat (player): patient" +
					"<select name='playergator" + number + "' >" +
						"<option selected='selected'>1</option>" +
						"<option>2</option>" +
						"<option>3</option>" +
						"<option>4</option>" +
						"<option>5</option>" +
						"<option>6</option>" +
						"<option>7</option>" +
						"<option>8</option>" +
						"<option>9</option>" +
						"<option>10</option>" +
						"<option>11</option>" +
						"<option>12</option>" +
					"</select>" +
					"into the " +
					"<select name='playergroupgator" + number + "' >" +
						"<option selected='selected' value='treatment'>Treatment</option>" +
						"<option value='control'>Control</option>" +
					"</select>" +
					"group." +
				"</div>";
};

Investigator = function (number, select, group, strategy) {
	this.number = number;
	this.settingsPanel = undefined;
	this.targetGroup = group === undefined ? "treatment" : group;
	this.selectPatient = select === undefined ? 1 : select;
	this.strategy = strategy === undefined ? "player" : strategy;

	this.createPanel = function (elem) {
		var investigatorClosure;

		investigatorClosure = this;
		this.settingsPanel = $(investigatorBlock(this.number)).appendTo(elem);

		this.stratSelect = $(this.settingsPanel).children("input[name='gator" + this.number + "']");
		this.computerTarget = $(this.settingsPanel).children("select[name='computergroupgator" + this.number + "']");
		this.computerSelect = $(this.settingsPanel).children("select[name='computergator" + this.number + "']");
		this.playerTarget = $(this.settingsPanel).children("select[name='playergroupgator" + this.number + "']");
		this.playerSelect = $(this.settingsPanel).children("select[name='playergator" + this.number + "']");

		$(this.playerSelect).change(function () {
			if (investigatorClosure.strategy === "player") {
				investigatorClosure.selectPatient = parseInt($(this).val(), 10);
			}
		});
		$(this.playerGroup).change(function () {
			if (investigatorClosure.strategy === "player") {
				investigatorClosure.targetGroup = $(this).val();
			}
		});
		$(this.computerSelect).change(function () {
			if (investigatorClosure.strategy === "computer") {
				investigatorClosure.selectPatient = parseInt($(this).val());
			}
		});
		$(this.computerGroup).change(function () {
			if (investigatorClosure.strategy === "computer") {
				investigatorClosure.targetGroup = $(this).val();
			}
		});
		$(this.stratSelect).change(function () {
			investigatorClosure.strategy = $(this).filter(":checked").val();
			switch(investigatorClosure.strategy) {
				case "normal":
					investigatorClosure.selectPatient = 1;
					investigatorClosure.targetGroup = "treatment";
					break;
				case "computer":
					investigatorClosure.selectPatient = parseInt($(investigatorClosure.computerSelect).val(), 10);
					investigatorClosure.targetGroup = $(investigatorClosure.computerGroup).val();
					break;
				case "player":
					investigatorClosure.selectPatient = parseInt($(investigatorClosure.playerSelect).val(), 10);
					investigatorClosure.targetGroup = $(investigatorClosure.playerGroup).val();
					break;
				default:
					throw "Improper selection";
			}
		});
	};
	this.deletePanel = function () {
		this.settingsPanel.remove();
	};
};

Study = function () {
	var index;

	this.count = 0;
	this.patients = [patientTypes[0], patientTypes[1], patientTypes[2], patientTypes[3]];
	this.nextButton = $("button#next");

	this.control = new Group("control", $("#control > .maintable"), 0);
	this.treatment = new Group("treatment", $("#treatment > .maintable"), 0);

	this.showEverything = $("input[name=playerview]:checked").val() === "full";
	this.allTurns = $("input[name=autoplay]:checked").val() === "false";

	this.heldTurns = parseInt($("select[name=heldturns]").val(), 10);
	this.heldPatients = parseInt($("select[name=heldpatients]").val(), 10);

	this.includeInvestigator = $("input[name=minimizeinvestigator]").is(":checked");
	this.diffExp = 1;
	this.blockSize = 1;

	if (!this.includeInvestigator) {
		$(".maintable .gator").hide();
	} else {
		for (index = 0; index < numInvestigators; index++) {
			$("#treatment > .maintable .title").append("<td>Investigator " + (index + 1) + "</td>");
			$("#treatment > .maintable .table").append("<td class='gator" + (index + 1) + "'>0</td>");
			$("#control > .maintable .title").append("<td>Investigator " + (index + 1) + "</td>");
			$("#control > .maintable .table").append("<td class='gator" + (index + 1) + "'>0</td>");
		}
		$(".maintable .gator").prop("colspan", numInvestigators);
	}

	this.currentPatObj = {
		num : $("a#patientnumber"),
		male : $("tr.patient > td.male"),
		female : $("tr.patient > td.female"),
		young : $("tr.patient > td.young"),
		middle : $("tr.patient > td.middle"),
		old : $("tr.patient > td.old"),
		low : $("tr.patient > td.low"),
		high : $("tr.patient > td.high")
	};
	this.deal = function () {
		this.currentPatient(patientTypes[this.count % 12]);
		this.count++;
	};
	this.currentPatient = function (patient) {
		this.currentPatObj.num.text(patient.number);
		this.currentPatObj.male.text(patient.gender === "male" ? 1 : 0);
		this.currentPatObj.female.text(patient.gender === "female" ? 1 : 0);
		this.currentPatObj.young.text(patient.age === "young" ? 1 : 0);
		this.currentPatObj.middle.text(patient.age === "middle" ? 1 : 0);
		this.currentPatObj.old.text(patient.age === "old" ? 1 : 0);
		this.currentPatObj.low.text(patient.risk === "low" ? 1 : 0);
		this.currentPatObj.high.text(patient.risk === "high" ? 1 : 0);
	};

	this.minimize = function (patient, gatorNumber, fullDets) {
		var ret, minFn, index, prop, treatDiff, controlDiff, newControl, newTreatment;
		newControl = jQuery.extend(true, {}, this.control);
		newTreatment = jQuery.extend(true, {}, this.treatment);

		newControl.addPatient(patient, gatorNumber);
		newTreatment.addPatient(patient, gatorNumber);

		treatDiff = 0;
		controlDiff = 0;

		minFn = function (a, b, exp) {
			return Math.pow(Math.abs(a - b), exp);
		};
		for (prop in newControl.characteristics) {
			if (newControl.characteristics.hasOwnProperty(prop)) {
				treatDiff += minFn(newTreatment.characteristics[prop].count, this.control.characteristics[prop].count, this.diffExp);
				controlDiff += minFn(newControl.characteristics[prop].count, this.treatment.characteristics[prop].count, this.diffExp);
			}
		}
		if (this.includeInvestigator) {
			for (index = 1; index <= numInvestigators; index++) {
				treatDiff += minFn(newTreatment.characteristics["gator" + index].count, this.control.characteristics["gator" + index].count, this.diffExp);
				controlDiff += minFn(newControl.characteristics["gator" + index].count, this.treatment.characteristics["gator" + index].count, this.diffExp);
			}
		}
		if (treatDiff > controlDiff) {
			ret = "control";
		} else if (controlDiff > treatDiff) {
			ret = "treatment";
		} else {
			ret = "tie";
		}
		if (fullDets) {
			return {
				treatment : newTreatment,
				control : newControl,
				ret : ret,
				treatDiff : treatDiff,
				controlDiff : controlDiff
			};
		} else {
			return ret;
		}
	};

	this.addPatient = function (patient, gator) {
		var min, randomPick;
		if (this.blockSize === 1) {
			min = this.minimize(patient, gator.number, true);
			if (min.ret === "control") {
				this.control = min.control;
			} else if (min.ret === "treatment") {
				this.treatment = min.treatment;
			} else {
				// 1 is treatment, 0 is control
				randomPick = Math.floor(Math.random() * 2) === 1;
				if (randomPick) {
					this.treatment = min.treatment;
				} else {
					this.control = min.control;
				}
			}
		} else {
			throw "Not implemented yet";
		}
	};
};

Group = function (name, table, numInvestigators) {
	var index;
	this.name = name;
	this.table = table;
	this.row = this.table.find(".table." + this.name);
	this.patients = [];

	this.characteristics = {
		male: { name: "male", count: 0, elem: this.row.children(".male"), active: true},
        female: { name: "female", count: 0, elem: this.row.children(".female"), active: true},
        young: { name: "young", count: 0, elem: this.row.children(".young"), active: true},
        middle: { name: "middle", count: 0, elem: this.row.children(".middle"), active: true},
        old: { name: "old", count: 0, elem: this.row.children(".old"), active: true},
        low: { name: "low", count: 0, elem: this.row.children(".low"), active: true},
        high: { name: "high", count: 0, elem: this.row.children(".high"), active: true}
	};

	for (index = 1; index <= numInvestigators; index++) {
		this.characteristics["gator" + index] =
			{ count: 0, elem: this.table.children(".i" + index), active: true};
	}

	this.addPatient = function (patient, gatorNumber) {
		var variat, prop;
		this.patients.push(patient);
		for (prop in this.characteristics) {
			if (this.characteristics.hasOwnProperty(prop)) {
				variat = this.characteristics[prop];
				variat.count = variat.count + patient[variat.name];
			}
		}
		if (this.characteristics["gator" + gatorNumber] !== undefined) {
			this.characteristics["gator" + gatorNumber].count++;
		}
	};

	this.updateTable = function () {
		var characteristic, prop;
		for (prop in this.characteristics) {
			if (this.characteristics.hasOwnProperty(prop)) {
				characteristic = this.characteristics[prop];
				characteristic.elem.text(characteristic.count);
			}
		}

	};
};

Patient = function (num, gender, age, risk) {
	this.number = num;
	this.male = gender === "male" ? 1 : 0;
	this.female = gender === "female" ? 1 : 0;
	this.young = age === "young" ? 1 : 0;
	this.middle = age === "middle" ? 1 : 0;
	this.old = age === "old" ? 1 : 0;
	this.low = risk === "low" ? 1 : 0;
	this.high = risk === "high" ? 1 : 0;

	this.gender = gender;
	this.age = age;
	this.risk = risk;
};

stratRandom = function (patient) {
	if (currentStudy_.allTurns) {

	} else {
		currentStudy_.addPatient(patient);
	}
};

patientTypes = [
	new Patient(1, "male", "young", "low"),
	new Patient(2, "male", "young", "high"),
	new Patient(3, "male", "middle", "low"),
	new Patient(4, "male", "middle", "high"),
	new Patient(5, "male", "old", "low"),
	new Patient(6, "male", "old", "high"),
	new Patient(7, "female", "young", "low"),
	new Patient(8, "female", "young", "high"),
	new Patient(9, "female", "middle", "low"),
	new Patient(10, "female", "middle", "high"),
	new Patient(11, "female", "old", "low"),
	new Patient(12, "female", "old", "high")
];

$(document).ready(function () {

	numInvestigators = 1;
	allInvestigators = [];
	allInvestigators.push(new Investigator(1, 1, "treatment", "player"));
	allInvestigators[0].createPanel($("div#investigators"));

	$("#investigatornumber").on("change", function () {
		var newNum, index;

		newNum = parseInt($(this).val());
		if (newNum > numInvestigators) {
			for (index = numInvestigators + 1; index <= newNum; index++) {
				allInvestigators.push(new Investigator(index));
				allInvestigators[index - 1].createPanel($("div#investigators"));
			}
		} else {
			for (index = numInvestigators - 1; index >= newNum; index--) {
				allInvestigators[index].deletePanel();
				allInvestigators.splice(index, 1);
			}
		}
		numInvestigators = newNum;
	});

    $("select[name=seedtype]").change(function () {
        if ($("select[name=seedtype]").val() === "Random") {
            $("div#randompatients").show();
            $("div#setpatients").hide();
        } else {
            $("div#randompatients").hide();
            $("div#setpatients").show();
        }
    });

    $("input[name=includeall]").click(function () {
        if ($("input[name=includeall]").is(":checked")) {
            $("input[name=filterpatients]").prop("checked", true);
            $("input[name=includenone]").prop("checked", false);
        }
    });

    $("input[name=includenone]").click(function () {
        if ($("input[name=includenone]").is(":checked")) {
            $("input[name=filterpatients]").prop("checked", false);
            $("input[name=includeall]").prop("checked", false);
        }
    });

    $("input[name=filterpatients]").click(function () {
        var checkedLength = $("input[name=filterpatients]:checked").length;
        if (checkedLength === 0) {
            $("input[name=includenone]").prop("checked", true);
        } else if (checkedLength === 12) {
            $("input[name=includeall]").prop("checked", true);
        } else {
            $("input[name=includeall], input[name=includenone]").prop("checked", false);
        }
    });

	$("button#start").click(function () {
		$("div#studysetup").hide();
		$("div#patient").show();
		$("div#study").show();

		currentStudy_ = new Study();
		currentStudy_.nextButton.show();

		currentStudy_.nextButton.click(function () {
			currentStudy_.deal();
		});
	});
});