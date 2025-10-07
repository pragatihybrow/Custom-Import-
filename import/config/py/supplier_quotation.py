import frappe

def set_quotation_number(doc, method):
    if not doc.items:
        return

    # Example: take first child's request_for_quotation
    first_rfq = doc.items[0].request_for_quotation if doc.items else None
    
    # If you want multiple RFQs combined
    rfqs = list({d.request_for_quotation for d in doc.items if d.request_for_quotation})

    if rfqs:
        # Join multiple RFQs with comma
        doc.quotation_number = ", ".join(rfqs)
    else:
        doc.quotation_number = None
