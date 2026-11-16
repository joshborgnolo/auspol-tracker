#!/usr/bin/env python3
"""data/nt24-demo.json — see build_nt_demo_common.py's header.

usage: python3 -I .build/map/build_nt24_demo.py
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_nt_demo_common

build_nt_demo_common.demo_main("nt24")
