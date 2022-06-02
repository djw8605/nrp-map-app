import useSWR from 'swr'
import { PrometheusDriver } from 'prometheus-query';
import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';


const prom = new PrometheusDriver({
  endpoint: "https://thanos.nrp-nautilus.io/",
  baseURL: "/api/v1", // default value
  timeout: 60000
});


const fetcher = (url) => fetch(url).then((res) => res.json());

const setupGraph = (series, dom_id, title, background) => {
  // set the dimensions and margins of the graph
  var margin = { top: 20, right: 20, bottom: 30, left: 50 },
    width = 500,
    height = 150;
  
  series.forEach(function(d) {
    d.time = d3.isoParse(d.time);
  });

  // set the ranges
  var x = d3.scaleTime().range([0, width]);
  var y = d3.scaleLinear().range([height, 0]);

  // define the area
  var area = d3.area()
    .x(function (d) { return x(d.time); })
    .y0(height)
    .y1(function (d) { return y(d.value); });

  // define the line
  var valueline = d3.line()
    .x(function (d) { return x(d.time); })
    .y(function (d) { return y(d.value); });

  // append the svg obgect to the body of the page
  // appends a 'group' element to 'svg'
  // moves the 'group' element to the top left margin
  var svg = d3.select(dom_id).append("svg")
    .attr('viewBox', '0 0 500 150')
    .attr("class", background)
    //.attr("width", width + margin.left + margin.right)
    //.attr("height", height + margin.top + margin.bottom)
    .append("g");
  //.attr("transform",
  //  "translate(" + margin.left + "," + margin.top + ")");

  // scale the range of the data
  x.domain(d3.extent(series, function (d) { return d.time; }));
  //y.domain([0, d3.max(series, function (d) { return d.value; })]);
  y.domain([d3.min(series, d => d.value), d3.max(series, d => d.value) * 1.5]);

  // add the area
  svg.append("path")
    .data([series])
    .attr("class", "area")
    .attr("d", area);

  // add the valueline path.
  svg.append("path")
    .data([series])
    .attr("class", "line")
    .attr("d", valueline);

  const textElement = svg.append('text')
    .text(series[series.length - 1].value.toFixed())
    .attr('x', width / 2)
    .attr('y', height / 2)
    .attr('text-anchor', 'middle')
    .attr('alignment-baseline', 'central')
    .attr('font-size', '3em')
    .attr('font-weight', 'bold')
    .attr('fill', '#000');

  const titleElement = svg.append('text')
    .text(title)
    .attr('x', width / 2)
    .attr('y', 5)
    .attr('text-anchor', 'middle')
    .attr('alignment-baseline', 'hanging')
    .attr('font-size', '1.5em')
    .attr('font-weight', 'bold')
    .attr('fill', '#000');

}


export function GPUMetrics() {

  const {data, error} = useSWR('/api/prommetrics?query=gpumetrics', fetcher, { refreshInterval: 3600000 });
  const chart = useRef(null);
  if (data) {
    chart.current.innerHTML = '';
    console.log("Got data from api");
    console.log(data);
    setupGraph(data.values, '#gpumetrics', 'GPUs Allocated', "l-bg-orange");
  }



  return (
    <>
      <div className='col-md-4'>
        <div className='card'>
          <div id="gpumetrics" ref={chart} />
        </div>
      </div>
    </>
  );

}

export function CPUMetrics() {

  const {data, error} = useSWR('/api/prommetrics?query=cpumetrics', fetcher, { refreshInterval: 3600000 });
  const chart = useRef(null);
  if (data) {
    chart.current.innerHTML = '';
    console.log("Got data from api");
    console.log(data);
    setupGraph(data.values, '#cpumetrics', 'CPUs Allocated', "l-bg-green");
  }

  return (
    <>
      <div className='col-md-4'>
        <div className='card'>
          <div id="cpumetrics" ref={chart} />
        </div>
      </div>
    </>
  );

}

export function NamespaceMetrics() {



  const {data, error} = useSWR('/api/prommetrics?query=namespacemetrics', fetcher, { refreshInterval: 3600000 });
  const chart = useRef(null);
  if (data) {
    chart.current.innerHTML = '';
    console.log("Got data from api");
    console.log(data);
    setupGraph(data.values, '#namespacemetrics', 'Active Research Groups', "l-bg-cyan");
  }

  return (
    <>
      <div className='col-md-4'>
        <div className='card'>
          <div id="namespacemetrics" ref={chart} />
        </div>
      </div>
    </>
  );

}


