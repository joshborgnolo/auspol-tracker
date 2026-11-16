#!/usr/bin/env python3
"""data-nt16.json — see build_nt_common.py's header.

usage: python3 -I .build/map/build_nt16_data.py map/data
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_nt_common

build_nt_common.data_main("nt16")
