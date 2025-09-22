
from frappe import _

def get_dashboard_data(data):
    data["non_standard_fieldnames"]["Pickup Request"] = "po_no" 
    data["non_standard_fieldnames"]["Pickup Request"] = "purchase_order"  

    for transaction in data.get("transactions", []):
        if transaction.get("label") == _("Fulfillment"):
            transaction["items"].append("Pickup Request")
            break
    else:
        data["transactions"].append({
            "label": _("Fulfillment"),
            "items": ["Pickup Request"],
        })
    
    return data
