import frappe

def set_quotation_number(doc, method):
    if not doc.items:
        return

    # Get unique RFQs from child items
    rfqs = list({d.request_for_quotation for d in doc.items if d.request_for_quotation})

    if rfqs:
        # Join multiple RFQs with comma
        doc.quotation_number = ", ".join(rfqs)
        
        # Fetch transaction_date from the first RFQ
        first_rfq = rfqs[0]
        rfq_doc = frappe.get_doc("Request for Quotation", first_rfq)
        doc.custom_quotation_date = rfq_doc.transaction_date
    else:
        doc.quotation_number = None
        doc.custom_quotation_date = None
    
    # Fetch suppliers from Pickup Request
    if doc.custom_pickup_request:
        pickup_request = frappe.get_doc("Pickup Request", doc.custom_pickup_request)
        
        # Clear existing entries
        doc.custom_shipper_name = []
        
        # Get all suppliers from the child table (name_of_supplier)
        if pickup_request.name_of_supplier:
            for row in pickup_request.name_of_supplier:
                if row.supplier:
                    # Append as a child table row
                    doc.append("custom_shipper_name", {
                        "supplier": row.supplier  # Adjust field name if different in your child table
                    })