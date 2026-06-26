from typing import List, Dict, Union, TypedDict

class Item(TypedDict):
    name: str
    cost: float
    participants: Union[str, List[str]]

def compute_split(
    shares: Dict[str, float],
    items: List[Item],
    payee: str,
    tax: float,
    tip: float
) -> dict:
    """Pure calculation that returns a results dict."""
    pre_tax = {p: 0.0 for p in shares}
    total_item_cost = 0.0
    total_shares = sum(shares.values())

    for it in items:
        cost = it['cost']
        total_item_cost += cost
        parts = it['participants']
        if parts == 'all':
            for p, s in shares.items():
                pre_tax[p] += cost * (s / total_shares)
        else:
            per = cost / len(parts)
            for p in parts:
                pre_tax[p] += per

    grand_pre_tax = sum(pre_tax.values())
    if grand_pre_tax == 0:
        grand_pre_tax = 1  # avoid division by zero

    breakdown = {}
    debts = {}
    for p in shares:
        ratio = pre_tax[p] / grand_pre_tax
        p_tax = tax * ratio
        p_tip = tip * ratio
        total = pre_tax[p] + p_tax + p_tip
        breakdown[p] = {
            'pre_tax': round(pre_tax[p], 2),
            'tax': round(p_tax, 2),
            'tip': round(p_tip, 2),
            'total': round(total, 2),
        }
        if p != payee:
            debts[p] = round(total, 2)

    total_paid = round(total_item_cost + tax + tip, 2)
    payee_own = breakdown[payee]['total']
    net_advanced = round(total_paid - payee_own, 2)

    return {
        'payee': payee,
        'total_paid': total_paid,
        'payee_own_share': payee_own,
        'net_advanced': net_advanced,
        'breakdown': breakdown,
        'debts': debts,
    }


def calculate_split(
    shares: Dict[str, float],
    items: List[Item],
    payee: str,
    tax: float,
    tip: float
) -> None:
    result = compute_split(shares, items, payee, tax, tip)

    print(f"\nPayee **{result['payee']}** laid out a total of: ${result['total_paid']:.2f}")
    print(f" - Their own share:        ${result['payee_own_share']:.2f}")
    print(f" - Net advanced for others:${result['net_advanced']:.2f}\n")

    print("Each person owes the payee:")
    for p, amt in result['debts'].items():
        print(f"  - {p}: ${amt:.2f}")
    print()

def prompt_float(prompt: str) -> float:
    while True:
        try:
            return float(input(prompt).strip())
        except ValueError:
            print("  ▶ Please enter a valid number.")

def main():
    # 1) People & shares
    n = int(input("How many people? ").strip())
    shares: Dict[str, float] = {}
    for i in range(n):
        name = input(f"  Enter name #{i+1}: ").strip()
        share = prompt_float(f"    Enter {name}'s share count: ")
        shares[name] = share

    # 2) Payee
    while True:
        payee = input("Who paid the bill? ").strip()
        if payee in shares:
            break
        print("  ▶ That name isn't in the list above.")

    # 3) Items
    m = int(input("How many line-items? ").strip())
    items: List[Item] = []
    for i in range(m):
        print(f"\nItem #{i+1}:")
        name = input("  Name: ").strip()
        cost = prompt_float("  Cost: $")
        part = input("  Shared by (enter 'all' or comma-separated names): ").strip()
        if part.lower() == 'all':
            participants: Union[str, List[str]] = 'all'
        else:
            while True:
                participants = [p.strip() for p in part.split(',') if p.strip()]
                bad = [p for p in participants if p not in shares]
                if bad:
                    print(f"  ⚠️  Unknown participants: {bad}")
                    print(f"     Valid names: {list(shares.keys())}")
                    part = input("  Shared by (enter 'all' or comma-separated names): ").strip()
                    if part.lower() == 'all':
                        participants = 'all'
                        break
                else:
                    break
        items.append({'name': name, 'cost': cost, 'participants': participants})

    # 4) Tax & Tip
    tax = prompt_float("\nTotal tax: $")
    tip = prompt_float("Total tip: $")

    # compute & print
    calculate_split(shares, items, payee, tax, tip)

if __name__ == "__main__":
    main()