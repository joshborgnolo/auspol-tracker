#!/usr/bin/env python3
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import py_compile

import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_act_demo_common
build_act_demo_common.demo_main("act20")
