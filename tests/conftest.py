import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from seed.seed import connect, seed  # noqa: E402

TEST_GRAPH = "ripple_test"


@pytest.fixture(scope="session")
def g():
    db = connect()
    seed(db, TEST_GRAPH, ROOT / "seed" / "graph.yaml", ROOT / "seed" / "assets.yaml")
    yield db.select_graph(TEST_GRAPH)
    db.select_graph(TEST_GRAPH).delete()
