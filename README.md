# Minimization
This is code for research done with Don Taves on the effectiveness of Minimization in creating balanced treatment and control groups for clinical trials. One of the goals of this tool is to determine if fradulent investigators can be prevented from both imbalancing trial groups (e.g. all the women in one group) and from placing their "select patients" into a particular group. As Minimization is not random and creates the groups entirely deterministically, we also have to be sure that Minimization does not present any additional opportunities for imbalancing the groups that are not present when the groups are randomized. Check out a demo at http://jaytaves.github.io/Minimization/

### This Game
* The game simulates a (usually clinical) trial being setup with two groups, treatment and control.
* The goal of a good setup is for the groups to be balanced (e.g. both groups have an equal number of females and other traits).
* Traditionally this has done by various randomizing strategies, minimization is an algorithm that is much better.

### Patients
* There are twelve types of patients, each with a gender, age and risk factor
* The minimization algorithm attempts to minimize the difference between these factors across the groups
* By placing or adding a patient to the study, the patient will be placed (by the algorithm) into a group that minimizes the difference between the two groups.
* After being added, patients cannot be retrieved

### Investigators
* Each investigator has the goal of getting as many of their select patients (one of 12 patient types) into the target group (treatment or control) as possible.
* Investigators can hold some (predetermined) number of patients for some (predetermined) number of turns after which they discard it.
* On their turn, an investigator is given a patient, and can place, hold or discard any of the patient they were given along with the patients they are holding.
* Investigators know the minimization algorithm and some strategies attempt to take advantage of this.
* Investigators have three possible strategies, the normal strategy where they place every patient they are given, the computer controlled strategy where they attempt to cheat to place their select patient and the player strategy where the user controls the actions of the investigator
* Investigators go in turns and their actions are displayed in the message box

### Computer Strategy
* If the computer receives a select patient it tries to place it, otherwise it discards the patient
* If the select patient cannot be placed into the target group, it either holds the patient, or tries to send a "sacrificial" patient into the opposite group after which it will hopefully be able to place the select patient into the target group
