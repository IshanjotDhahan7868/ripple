"""Every Cypher query Ripple runs. Human-written; the model only picks one and supplies parameters."""

# Max hop count is a literal: FalkorDB does not take a parameter in a variable-length bound.
MAX_DEPTH = 4

RESOLVE_EXACT = """
MATCH (d:Driver) WHERE d.id IN $ids
RETURN d.id AS id, d.name AS name, d.theme AS theme
"""

RESOLVE_FULLTEXT = """
CALL db.idx.fulltext.queryNodes('Driver', $q) YIELD node, score
RETURN node.id AS id, node.name AS name, node.theme AS theme, score
ORDER BY score DESC LIMIT $limit
"""

PROPAGATE = f"""
MATCH p = (s:Driver)-[:DRIVES*1..{MAX_DEPTH}]->(t:Driver)
WHERE s.id IN $sources AND length(p) <= $depth
WITH p, t,
     reduce(x = 1.0, r IN relationships(p) | x * r.weight * r.confidence) AS strength,
     reduce(l = 0, r IN relationships(p) | l + r.lag_months) AS lag,
     reduce(sg = 1, r IN relationships(p) | sg * r.polarity) AS sign
WHERE strength >= $min_strength
RETURN t.id AS node, strength, lag, sign, [n IN nodes(p) | n.id] AS path
"""

EXPOSED_ASSETS = """
MATCH (a:Asset)-[:EXPOSED_TO]->(d:Driver) WHERE d.id IN $nodes
WITH a, collect(d.id) AS hit
MATCH (a)-[:EXPOSED_TO]->(all:Driver)
RETURN a.ticker AS ticker, a.type AS type, hit, count(all) AS exposure_count
"""

ASSET_EXPOSURE = """
MATCH (a:Asset {ticker: $ticker})-[:EXPOSED_TO]->(d:Driver)
RETURN a.type AS type, d.id AS id
"""

# the reverse of PROPAGATE: every part of the economy that reaches this asset, and how
ASSET_UPSTREAM = """
MATCH (a:Asset {ticker: $ticker})-[:EXPOSED_TO]->(d:Driver)
MATCH p = (s:Driver)-[:DRIVES*1..3]->(d)
WITH p, s,
     reduce(x = 1.0, r IN relationships(p) | x * r.weight * r.confidence) AS strength,
     reduce(l = 0, r IN relationships(p) | l + r.lag_months) AS lag,
     reduce(sg = 1, r IN relationships(p) | sg * r.polarity) AS sign
WHERE strength >= $min_strength
RETURN s.id AS source, strength, lag, sign, [n IN nodes(p) | n.id] AS path
"""

ASSET_PEERS = """
MATCH (a:Asset {ticker: $ticker})-[:EXPOSED_TO]->(d:Driver)<-[:EXPOSED_TO]-(b:Asset)
WHERE b.ticker <> $ticker
RETURN b.ticker AS ticker, b.type AS type, count(d) AS shared
ORDER BY shared DESC, ticker LIMIT 10
"""

EXPLAIN_LINK = """
MATCH (a:Driver {id: $src}), (b:Driver {id: $dst})
CALL algo.SPpaths({sourceNode: a, targetNode: b, relTypes: ['DRIVES'],
                   relDirection: 'outgoing', pathCount: 1})
YIELD path, pathWeight
RETURN [n IN nodes(path) | n.id] AS path, pathWeight AS hops
"""

SYSTEMIC_PAGERANK = """
CALL algo.pageRank('Driver', 'DRIVES') YIELD node, score
RETURN node.id AS id, node.theme AS theme, score
ORDER BY score DESC LIMIT $limit
"""

SYSTEMIC_REACH = """
MATCH (s:Driver)-[:DRIVES*1..4]->(t:Driver)
RETURN s.id AS id, s.theme AS theme, count(DISTINCT t) AS reach
ORDER BY reach DESC LIMIT $limit
"""

RECALL_EVENTS = """
MATCH (e:Event)-[:HIT]->(d:Driver) WHERE d.id IN $nodes AND e.at >= $since
RETURN e.id AS id, e.headline AS headline, e.at AS at, e.direction AS direction, collect(d.id) AS nodes
ORDER BY at DESC LIMIT $limit
"""

RECORD_EVENT = """
CREATE (e:Event {id: $id, headline: $headline, at: $at, direction: $direction, url: $url})
WITH e
UNWIND $nodes AS nid
MATCH (d:Driver {id: nid})
CREATE (e)-[:HIT]->(d)
RETURN e.id AS id
"""

CREATE_ALERT = """
MATCH (e:Event {id: $event_id})
CREATE (al:Alert {id: $id, text: $text, at: $at, answer_type: $answer_type})-[:FROM]->(e)
WITH al
UNWIND $tickers AS t
MATCH (a:Asset {ticker: t})
CREATE (al)-[:FLAGS]->(a)
RETURN al.id AS id
"""
