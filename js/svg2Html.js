function createElement(path, index, name) {
	const d = path.getAttribute("d");

	const start = document.createElementNS("http://www.w3.org/2000/svg", "path");
	start.setAttribute("d", d);
	start.setAttribute("class", name + String(index) + " " + name + "Class");

	return start
}
//這：0
//福：1
dataNum = 2
getSVG(svgData[dataNum]["svg"])
function getSVG(svgData) {
	var svgText = svgData
	const parser = new DOMParser();
	const doc = parser.parseFromString(svgText, "image/svg+xml");

	const paths = doc.querySelectorAll("path");

	const morphGroup = document.getElementById("morph");
	const morphGroupGray = document.getElementById("morphGray");
	pathAmount = 0

	morphGroup.innerHTML = ""
	morphGroupGray.innerHTML = ""

	paths.forEach((path, index) => {
		morphGroup.appendChild(createElement(path, index, "start"));
		morphGroup.appendChild(createElement(path, index, "end"));
		morphGroupGray.appendChild(createElement(path, index, "gray"));
		pathAmount++;
	});
}
