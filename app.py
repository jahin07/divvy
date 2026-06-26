import os
from flask import Flask, request, jsonify, send_from_directory
from bill_split import compute_split
import splitwise_client as sw
from splitwise_client import build_expense_payload, SplitwiseError

DIST_DIR = os.path.join(os.path.dirname(__file__), 'static', 'dist')

app = Flask(__name__, static_folder=DIST_DIR, static_url_path='')


@app.route('/api/calculate', methods=['POST'])
def calculate():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({'error': 'Invalid JSON'}), 400

    # Validate required fields
    for field in ('shares', 'items', 'payee', 'tax', 'tip'):
        if field not in data:
            return jsonify({'error': f'Missing field: {field}'}), 400

    shares = data['shares']
    items = data['items']
    payee = data['payee']
    tax = data['tax']
    tip = data['tip']

    if not isinstance(shares, dict) or len(shares) < 2:
        return jsonify({'error': 'Need at least 2 people'}), 400

    if payee not in shares:
        return jsonify({'error': f'Payee "{payee}" is not in the people list'}), 400

    if not isinstance(items, list) or len(items) == 0:
        return jsonify({'error': 'Need at least 1 item'}), 400

    # Validate items
    for i, item in enumerate(items):
        for key in ('name', 'cost', 'participants'):
            if key not in item:
                return jsonify({'error': f'Item #{i+1} missing "{key}"'}), 400
        if not isinstance(item['cost'], (int, float)) or item['cost'] < 0:
            return jsonify({'error': f'Item #{i+1} has invalid cost'}), 400
        parts = item['participants']
        if parts != 'all':
            if not isinstance(parts, list) or len(parts) == 0:
                return jsonify({'error': f'Item #{i+1} needs at least 1 participant'}), 400
            unknown = [p for p in parts if p not in shares]
            if unknown:
                return jsonify({'error': f'Item #{i+1} has unknown participants: {unknown}'}), 400

    if not isinstance(tax, (int, float)) or tax < 0:
        return jsonify({'error': 'Invalid tax amount'}), 400
    if not isinstance(tip, (int, float)) or tip < 0:
        return jsonify({'error': 'Invalid tip amount'}), 400

    # Guard against all-zero shares
    if sum(shares.values()) == 0:
        return jsonify({'error': 'Total shares cannot be zero'}), 400

    result = compute_split(shares, items, payee, tax, tip)
    return jsonify(result)


@app.route('/api/splitwise/status', methods=['GET'])
def splitwise_status():
    try:
        user = sw.get_current_user()
        return jsonify({'configured': True, 'user': user})
    except SplitwiseError:
        return jsonify({'configured': False})


@app.route('/api/splitwise/groups', methods=['GET'])
def splitwise_groups():
    try:
        return jsonify({'groups': sw.get_groups()})
    except SplitwiseError as e:
        return jsonify({'error': e.message}), e.status


@app.route('/api/splitwise/friends', methods=['GET'])
def splitwise_friends():
    try:
        return jsonify({'friends': sw.get_friends()})
    except SplitwiseError as e:
        return jsonify({'error': e.message}), e.status


@app.route('/api/splitwise/expense', methods=['POST'])
def splitwise_expense():
    data = request.get_json(silent=True) or {}
    try:
        payload = build_expense_payload(
            result=data['result'],
            payee=data['payee'],
            mapping=data['mapping'],
            group_id=data.get('groupId'),
            description=data.get('description', 'Divvy split'),
        )
    except (KeyError, ValueError) as e:
        return jsonify({'error': f'Invalid request: {e}'}), 400
    try:
        expense_id = sw.create_expense(payload)
        return jsonify({'ok': True, 'expenseId': expense_id})
    except SplitwiseError as e:
        return jsonify({'error': e.message}), e.status


@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path and os.path.exists(os.path.join(DIST_DIR, path)):
        return send_from_directory(DIST_DIR, path)
    return send_from_directory(DIST_DIR, 'index.html')


if __name__ == '__main__':
    app.run(debug=True, port=5001)
