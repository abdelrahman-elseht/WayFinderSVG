"""Source rail envelopes; features never imply inter-floor routing."""
from shapely.geometry import MultiPoint
def derive_features(read):
    source=read('maps/B03/GF/source/0001.json'); paths={p['id']:p for p in source['paths']}; out=[]
    for side,ids,ar in [('west',['0001-path-08616','0001-path-08574'],'الغربي'),('east',['0001-path-08684','0001-path-08642'],'الشرقي')]:
        pts=[xy for i in ids for it in paths[i]['items'] for xy in it['points']]; poly=MultiPoint(pts).convex_hull
        out.append(dict(id='B03-GF-escalator-'+side,buildingId='B03',floorId='GF',name=dict(en='Main Entrance escalator ('+side+')',ar='السلم المتحرك بجوار المدخل الرئيسي ('+ar+')'),kind='escalator',polygon=[[round(x,3),round(y,3)] for x,y in poly.exterior.coords[:-1]],geometryStatus='candidate',accessibility='unknown',connectedFloorIds=[],provenance=[dict(source='maps/B03/GF/source/0001.json#'+i,page=1,status='candidate',note='Drawn A-ELEV rail endpoints bound the escalator beside G01. This source feature has no inferred upper-floor connection or accessibility claim.') for i in ids]))
    return out
