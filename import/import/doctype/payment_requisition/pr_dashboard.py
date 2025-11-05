
from frappe import _

def get_dashboard_data(data):
    data["non_standard_fieldnames"]["Journal Entry"] = "custom_payment_requisition" 
    data["non_standard_fieldnames"]["Journal Entry"] = "journal_entry"  

    for transaction in data.get("transactions", []):
        if transaction.get("label") == _("Fulfillment"):
            transaction["items"].append("Journal Entry")
            break
    else:
        data["transactions"].append({
            "label": _("Fulfillment"),
            "items": ["Journal Entry"],
        })
    
    return data
