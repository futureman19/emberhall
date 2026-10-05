"""Rerender candidate-only polish; baseline source/GLB/renders stay byte-preserved."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from build_characters import candidate,VARIANTS
for variant in VARIANTS:candidate(variant)
print('CANDIDATE REFINEMENT COMPLETE')
