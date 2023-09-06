import useSWR from 'swr'
import { PrometheusDriver } from 'prometheus-query';
import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { update } from '../redux/updateTime'
import { useDispatch } from 'react-redux'


const prom = new PrometheusDriver({
  endpoint: "https://thanos.nrp-nautilus.io/",
  baseURL: "/api/v1", // default value
  timeout: 60000
});


const fetcher = (url) => fetch(url).then((res) => res.json());

const setupGraph = (series, dom_id, title, background, showgraph = true) => {
  // set the dimensions and margins of the graph
  var margin = { top: 20, right: 20, bottom: 30, left: 50 },
    width = 500,
    height = 150;

  series.forEach(function (d) {
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
  y.domain([d3.min(series, d => d.value), d3.max(series, d => d.value) * 1]);

  if (showgraph) {
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
  }



  if (series.length != 0) {
    const textElement = svg.append('text')
      .text(series[series.length - 1].value.toFixed())
      .attr('x', width / 2)
      .attr('y', height / 2)
      .attr('text-anchor', 'middle')
      .attr('alignment-baseline', 'central')
      .attr('font-size', '3em')
      .attr('font-weight', 'bold')
      .attr('fill', '#000');
  } else {
    // Loading...
    const textElement = svg.append('text')
      .text("Loading...")
      .attr('x', width / 2)
      .attr('y', height / 2)
      .attr('text-anchor', 'middle')
      .attr('alignment-baseline', 'central')
      .attr('font-size', '3em')
      .attr('font-weight', 'bold')
      .attr('fill', '#000');

    svg.append('g')
      .attr('transform', 'scale(0.6, 0.6)')
      .append('path')
      .attr('fill', '#000')
      .attr('d', "M73,50c0-12.7-10.3-23-23-23S27,37.3,27,50 M30.9,50c0-10.5,8.5-19.1,19.1-19.1S69.1,39.5,69.1,50")
      .attr('x', 0)
      .attr('y', 0)
      .append('animateTransform')
      .attr('attributeName', 'transform')
      .attr('type', 'rotate')
      .attr('from', '0 50 50')
      .attr('to', '360 50 50')
      .attr('dur', '1s')
      .attr('repeatCount', 'indefinite');

  }

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

function errorMessages(errorMsg, clickReload) {
  return (
    <div className='flex justify-center items-center flex-col'>
      <div role="status" className='mt-3 flex flex-row items-center'>
        <div>
          <p className='text-sm font-medium text-gray-900 dark:text-white'>{errorMsg}</p>
        </div>
        <div className='ml-2'>
          <div className="spinner-border spinner-border-sm" role="status">
          </div>
        </div>
        <span className="sr-only">Loading...</span>
      </div>
      <div className='mt-3'>
        <button onClick={() => { clickReload(); }} className='text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 mr-2 mb-2 dark:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none dark:focus:ring-blue-800'>
          Reload
        </button>
      </div>
    </div>
  )
}


export function GPUMetrics() {

  const { data, error, mutate } = useSWR('/api/prommetrics?query=gpumetrics', fetcher, { refreshInterval: 3600000 });
  const chart = useRef(null);
  const dispatch = useDispatch();
  if (data) {
    chart.current.innerHTML = '';
    console.log("Got data gpu from api");
    console.log(data);
    setupGraph(data.values, '#gpumetrics', 'GPUs Allocated', "l-bg-orange");
    dispatch(update(data.updateTime));
  } else {
    // Loading state


  }

  useEffect(() => {
    chart.current.innerHTML = '';
    setupGraph([], '#gpumetrics', 'GPUs Allocated', "l-bg-orange");
  }, []);




  return (
    <>
      <div className='col-md-4'>
        <div className='card'>
          <div id="gpumetrics" ref={chart} />
          {error && errorMessages("Error loading GPU Metrics",  mutate )}
        </div>
      </div>
    </>
  );

}

export function CPUMetrics() {

  const { data, error, mutate } = useSWR('/api/prommetrics?query=numpods', fetcher, { refreshInterval: 3600000 });
  const chart = useRef(null);
  const dispatch = useDispatch();
  if (data) {
    chart.current.innerHTML = '';
    console.log("Got data from api");
    console.log(data);
    setupGraph(data.values, '#runningpods', 'Running Pods', "l-bg-green");
    dispatch(update(data.updateTime));
  }

  useEffect(() => {
    chart.current.innerHTML = '';
    setupGraph([], '#runningpods', 'Running Pods', "l-bg-green");
  }, []);

  return (
    <>
      <div className='col-md-4'>
        <div className='card'>
          <div id="runningpods" ref={chart} />
          {error && errorMessages("Error loading Pod Metrics",  mutate )}
        </div>
      </div>
    </>
  );

}

export function NamespaceMetrics() {



  const { data, error, mutate } = useSWR('/api/prommetrics?query=namespacemetrics', fetcher, { refreshInterval: 3600000 });
  const chart = useRef(null);
  const dispatch = useDispatch();
  if (data) {
    chart.current.innerHTML = '';
    console.log("Got data from api");
    console.log(data);
    setupGraph(data.values, '#namespacemetrics', 'Active Research Groups', "l-bg-cyan");
    dispatch(update(data.updateTime));
  }

  useEffect(() => {
    chart.current.innerHTML = '';
    setupGraph([], '#namespacemetrics', 'Active Research Groups', "l-bg-cyan");
  }, []);

  return (
    <>
      <div className='col-md-4'>
        <div className='card'>
          <div id="namespacemetrics" ref={chart} />
          {error && errorMessages("Error loading Group Metrics",  mutate )}
        </div>
      </div>
    </>
  );

}




