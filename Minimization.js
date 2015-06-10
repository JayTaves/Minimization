var currentStudy_, investigatorBlock, numInvestigators, Investigator, Study, Patient, patientTypes, allInvestigators;

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
	this.count = 0;
	this.patients = [patientTypes[0], patientTypes[1], patientTypes[2], patientTypes[3]];
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
};

Patient = function (num, gender, age, risk) {
	this.number = num;
	this.gender = gender;
	this.age = age;
	this.risk = risk;
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
	$("button#start").click(function () {
		$("div#studysetup").hide();
		$("div#patient").show();
		$("div#study").show();
		currentStudy_ = new Study();
	});
});