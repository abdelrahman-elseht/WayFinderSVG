"""Emit both real workers' temporary serialized publications for TS contract tests."""
import json
import sys
from admin_authoring_test import AdminAuthoringWorkerTests


def main():
    output = []
    for floor_id in ('GF', '01'):
        test = AdminAuthoringWorkerTests()
        try:
            worker, root, floor, graph, source = test.isolated(floor_id)
            result = worker.execute({**test.payload(worker, floor_id, source), 'action': 'save'})
            snapshot = json.loads(worker.persistence.snapshot_path(root, floor_id).read_text('utf-8'))
            contents = [{'id': 'lab-content', 'description': {'en': 'Synthetic', 'ar': 'Synthetic'},
                         'placeholder': True, 'image': None, 'imageAlt': {'en': 'Synthetic', 'ar': 'Synthetic'}}]
            output.append({'floorId': floor_id, 'canonicalFloor': floor, 'canonicalGraph': graph,
                           'snapshot': snapshot, 'contents': contents})
        finally:
            test.doCleanups()
    sys.stdout.write(json.dumps(output))


if __name__ == '__main__':
    main()
