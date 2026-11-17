#!/usr/bin/env python3
"""data/act16-seifa.json — see build_act_seifa_common.py's header.

usage: python3 -I .build/map/build_act16_seifa.py
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_act_seifa_common

build_act_seifa_common.seifa_main("act16")
