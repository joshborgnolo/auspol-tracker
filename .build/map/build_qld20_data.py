#!/usr/bin/env python3
"""data-qld20.json for /map/ — the Queensland state election of 31 Oct 2020
(93 Legislative Assembly districts). The emitter is build_qld_common.py
(qld_ecq.py's ElectionData from the VRS media-feed XML); see its header for
sources, doctrine and the lane contract.

usage: python3 -I .build/map/build_qld20_data.py <out_dir>; then geo_build.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_qld_common import data_main

data_main("qld20")
