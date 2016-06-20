def get_pts(filename):
	with open(fname) as f:
		content = f.readlines()
	return content

msg_arr = get_pts()