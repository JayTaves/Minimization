def get_pts(file_num):
	"""This function reads a text file from the path and pushes it
		into a list where each line is an entry"""

	file_path = "C:/Users/Jay/Documents/Programming/Minimization/prePostPatientAnalysis/sheet" + str(file_num) + ".txt"
	with open(file_path) as f:
		content = f.readlines()
	return content

def process_line(line):
	"""Sorts through a list of strings in the format of minimization
		output and translates it into a simple representation of
		what happened.
		'Investigator n sorted patient y to group g' -> [n, y, g]"""

	broken = line.split(' ')

	return [int(broken[1]), int(broken[4][:-1]), broken[-2]]

def index_success(list):
	"""Takes a list in minimization representation and finds the index
		of everytime a select patient was sorted to treatment"""

	indices = []
	for index in range(len(list)):
		l = list[index]
		if l[1] == 1:
			indices.append(index)

	return indices

def compile_nth_away(n, assignments, indices):
	"""Gets a list of all the patients assigned n patients after the
		select assignment"""

	ix = indices
	a = assignments
	return [a[x + n][1] for x in ix if x + n < len(a) and x + n > 0]

def compile_frequency(lst):
	"""Goes through a list of ints and compiles the frequency of each
		one in the list
		[1, 1, 2, 2, 2, 3, 4, 5, 5, 5] -> [2, 3, 1, 1, 3]"""

	frequency = [0] * 12
	for i in range(len(lst)):
		frequency[lst[i] - 1] = frequency[lst[i] - 1] + 1

	return frequency

def print_out(n):
	"""Prints out the frequencies for the nth file"""

	res_arr = [process_line(line) for line in get_pts(n)]
	indices = index_success(res_arr)

	before = compile_frequency(compile_nth_away(1, res_arr, indices))
	after = compile_frequency(compile_nth_away(-1, res_arr, indices))

	print('"Before ' + str(n) + '"; ' + comma_list(before))
	print('"After ' + str(n) + '"; ' + comma_list(after))

def comma_list(lst):
	"""Returns a string containing the contents of a list"""
	st = ''
	for i in range(len(lst)):
		st = st + str(lst[i]) + '; '

	return st[0:len(st) - 2]

for i in range(20):
	if i + 1 is not 17 and i + 1 is not 15:
		print_out(i + 1)
