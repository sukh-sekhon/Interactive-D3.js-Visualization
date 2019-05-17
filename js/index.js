const secondaryScreen = d3.selectAll('.secondary-screen');
const tooltip = d3.select('.tooltip');
const maxRadius = 250;
const minRadius = 90;
let minSales, maxSales, maxSalesRadius, dataByPlatform, allGenres;

// Colors for game genres
const color = [
    '#D32F2F',
    '#7B1FA2',
    '#303F9F',
    '#0097A7',
    '#388E3C',
    '#FBC02D',
    '#F57C00'
];

// Colors for rating scale
const colorGYR = d3.scaleLinear()
    .domain([1, 5, 10])
    .range(['#d73027', '#fee08b', '#1a9850'])
    .interpolate(d3.interpolateHcl);

// Parsing data and setting up for primary/secondary screens
d3.csv('./data/dataset.csv')
    .then(function(rawData) {
        // Parsing Genres
        allGenres = d3.map(rawData, function(d){return d.Genre;}).keys();

        // Parsing Console Platforms
        dataByPlatform = d3.nest()
            .key(function(d) { return d.Platform; })
            .entries(rawData);

        // Calculate sales by platform / genre
        let salesByPlatform = d3.nest()
            .key(function(d) { return d.Platform; })
            .rollup(function(v) { return Math.floor(d3.sum(v, function(d) { return d.Global_Sales; }) * 100) / 100; })
            .entries(rawData);

        // Minimum number of sales
        minSales = Math.min.apply(Math, salesByPlatform.map(function(c) { return c.value; }));
        // Maximum number of sales
        maxSales = Math.max.apply(Math, salesByPlatform.map(function(c) { return c.value; }));
        // Calculate radius of donut charts such that area encodes sales
        maxSalesRadius = maxSales / (maxSales - minSales) * (maxRadius - minRadius);

        // Transform each platform data for visualizations
        dataByPlatform.forEach(function (cons, idx) {
            const name = cons.key;
            const sales = salesByPlatform[idx].value;

            // Calculate total sales and games count for each genre
            let platformByGenre = d3.nest()
                .key(function(d) {return d.Genre; })
                .rollup(function(d) {
                    return {
                        sales: Math.floor(d3.sum(d, function(dd) { return dd.Global_Sales; }) * 100) / 100,
                        gameCnt: d.length
                    };
                })
                .entries(cons.values);

            // Index sectors to sort by color
            platformByGenre.forEach(function (c) {
                c.idx = allGenres.indexOf(c.key + '');
            });
            platformByGenre.sort(function(a, b) {
                return a.idx - b.idx;
            });
            const chartArea = d3.selectAll('.chart').filter(function (d, i) { return i === idx;});

            // Attach charts to HTML
            drawPrimary(chartArea, name, sales, platformByGenre)
        });

        // Draw legends (both primary and secondary)
        drawLegends();
    })

    // throw error if .csv file isn't available
    .catch(function(error){
        console.log('dataset loading error: ', error);
    });


// Draw primary screen information
function drawPrimary(chartArea, platformName, totalSales, genreData) {

    // Chart title
    const header = chartArea.select('.platform-name');
    header.text(platformName);

    // Size of SVG chart elements
    const width = 500;
    const height = 500;
    let radius = totalSales / (maxSales - minSales) * (maxRadius - minRadius);

    // Attach chart
    const chart = chartArea.select('svg');
    chart
        .attr('viewBox', '0 0 ' + width + ' ' + height)
        .attr('class', platformName);
    const g = chart.append('g')
        .attr('transform', 'translate(' + (width / 2) + ',' + (height / 2) + ')');

    // Define shapes of sectors (both regular and expanded)
    const arc = d3.arc()
        .innerRadius(maxRadius - radius)
        .outerRadius(maxRadius);
    const expandSector = d3.arc()
        .innerRadius(maxRadius - maxSalesRadius)
        .outerRadius(maxRadius);

    // Define sectors size by sales
    const pie = d3.pie()
        .value(function(d) { return d.value.sales; })
        .sort(null);
    const sector = g.selectAll('path')
        .data(pie(genreData))
        .enter()
        .append('g')
        .attr('class', function(d) { return d.data.key; });

    // Append regular sectors
    sector.append('path')
        .attr('d', arc)
        .attr('fill', function(d) {
            return color[allGenres.indexOf(d.data.key + '')];
        })
        .attr('stroke', '#E9E9E9')
        .attr('stroke-width', '3');

    // Append expanded sectors (transparent)
    sector.append('path')
        .attr('d', expandSector)
        .attr('fill', '#E9E9E9')
        .attr('opacity', '0.01')
        .on('mouseover', function(d) {
            // Tooltip information
            tooltip
                .html('' +
                    '<b>Genre</b>:&nbsp;' + d.data.key + '</br>' +
                    '<b>Sales</b>: ' + d.data.value.sales + 'M</br>' +
                    '<b>Games Count</b>: ' + d.data.value.gameCnt)
                .style('display', 'block')
                .style('opacity', 1);
            // Change sector to expanded sector
            d3.select(this.previousElementSibling)
                .transition()
                .duration(300)
                .attr('d', expandSector);
        })
        .on('mousemove', function() {
            // Tooltip follows cursor position
            tooltip
                .style('top', (d3.event.layerY + 10) + 'px')
                .style('left', (d3.event.layerX - 25) + 'px');
        })
        .on('mouseout', function() {
            // Hide cursor when leaving sector
            tooltip
                .style('display', 'none')
                .style('opacity', 0);

            // Revert expanded sector back to regular
            d3.select(this.previousElementSibling)
                .transition()
                .duration(300)
                .attr('d', arc);
        })
        .on('click', function(d) {
            // Switch to secondary screen
            drawSecondary(platformName, d.data.key, d.data.value.sales);
        });

    // Append total sales text to centre of donut chart
    g.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '0')
        .text(totalSales + 'M');
    g.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '1em')
        .text('Sales');
}

// Draw secondary screen information
function drawSecondary (platform, genre, totalSales) {

    // Remove primary screen charts
    const chart = secondaryScreen.select('svg');
    chart.selectAll("*").remove();

    // Setup for new donut chart
    let platformAndGenre = [];
    for (let i = 0; i < dataByPlatform.length; i++) {
        if (dataByPlatform[i].key === platform) {
            dataByPlatform[i].values.forEach(function (g) {
                if (g.Genre === genre) {
                    platformAndGenre.push(g);
                }
            });
            break;
        }
    }
    // Sort by score
    platformAndGenre.sort(function(a, b){
        return d3.ascending(a.User_Score, b.User_Score);
    });

    // Size of SVG chart elements
    const width = 500;
    const height = 500;

    // Set up title
    secondaryScreen.select('.secondary-title')
        .html(platform + '&nbsp;' + genre + ' Games');

    // Attach chart
    chart
        .attr('viewBox', '0 0 ' + width + ' ' + height);
    const g = chart.append('g')
        .attr('class', 'chart')
        .attr('transform', 'translate(' + (width / 2) + ',' + (height / 2) + ')');

    // Define shapes of sectors
    const arc = d3.arc()
        .innerRadius(70)
        .outerRadius(maxRadius);

    // Define sectors size by sales
    const pie = d3.pie()
        .value(function(d) { return +d.Global_Sales; })
        .sort(null);
    const sector = g.selectAll('path')
        .data(pie(platformAndGenre))
        .enter()
        .append("g");

    // Append sectors
    sector.append('path')
        .attr('d', arc)
        .attr('fill', function (d) { return colorGYR(+d.data.User_Score); })
        .attr('stroke', '#E9E9E9')
        .attr('stroke-width', '3')
        .on('mouseover', function(d) {
            // Tooltip information
            tooltip.
                html('' +
                    '<b>Title</b>:&nbsp;' + d.data.Name + '</br>' +
                    '<b>Rating</b>:&nbsp;' + d.data.User_Score + '</br>' +
                    '<b>Sales</b>: ' + d.data.Global_Sales + 'M')
                .style('display', 'block')
                .style('opacity', 1);
        })
        .on('mousemove', function() {
            // Tooltip follows cursor position
            tooltip
                .style('top', (d3.event.layerY + 10) + 'px')
                .style('left', (d3.event.layerX - 25) + 'px');
        })
        .on('mouseout', function() {
            // Hide when leaving sector
            tooltip
                .style('display', 'none')
                .style('opacity', 0);
        });

    // Append title names to donut chart with appropriate rotation
    sector.append("text")
        .attr("transform", function(d) {
            let midAngle = d.endAngle < Math.PI ? d.startAngle/2 + d.endAngle/2 : d.startAngle/2  + d.endAngle/2 + Math.PI ;
            return "translate(" + arc.centroid(d)[0] + "," + arc.centroid(d)[1] + ") rotate(-90) rotate(" + (midAngle * 180/Math.PI) + ")"; })
        .attr("dy", ".35em")
        .attr("font-size", "0.75em")
        .attr('text-anchor','middle')
        // Truncate text if too long
        .text(function(d) {
            if (d.data.Name.length < 27)
                return (d.data.Name);
            else
                return (d.data.Name.substring(0, 24) + "...")
        });

    // Append total sales text to centre of donut chart
    g.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '0')
        .attr("font-size", "2.2em")
        .text(totalSales + 'M');
    g.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '1em')
        .attr("font-size", "2.2em")
        .text('Sales');


    // Display secondary chart
    secondaryScreen
        .style('display', 'block')
        .transition()
        .duration(300)
        .style('opacity', 1)
        .on('end', function () {
            // Go back to primary screen on click
            document.onclick = function () {
                secondaryScreen
                    .transition()
                    .duration(300)
                    .style('opacity', 0)
                    .on('end', function () {
                        secondaryScreen.style('display', 'none');
                        document.onclick = function () { };
                    })
            };
        })
}

// Draw legends (primary and secondary)
function drawLegends() {
    let legend = document.querySelector('.primary-info');
    let description = legend.querySelector('.description');
    let row, box, text;

    // Primary screen legend (Genre)
    allGenres.forEach(function(g, idx) {
        row = document.createElement('div');
        row.classList.add('legend-row');
        legend.insertBefore(row, description);

        box = document.createElement('div');
        box.classList.add('legend-box');
        box.style.backgroundColor = color[idx];
        row.appendChild(box);

        text = document.createElement('div');
        text.classList.add('legend-name');
        text.innerText = g;
        row.appendChild(text);
    });

    legend = document.querySelector('.secondary-info');
    description = legend.querySelector('.description');

    // Secondary screen legend (Rating)
    const ratesValue = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const ratesText = ['0', '1', '2', '3', '4', '5',  '6', '7',  '8', '9', '10'];
    ratesValue.forEach(function(r, idx) {
        row = document.createElement('div');
        row.classList.add('legend-row');
        legend.insertBefore(row, description);

        box = document.createElement('div');
        box.classList.add('legend-box');
        box.style.backgroundColor = colorGYR(r);
        row.appendChild(box);

        text = document.createElement('div');
        text.classList.add('legend-name');
        text.innerText = ratesText[idx];
        row.appendChild(text);
    });
}