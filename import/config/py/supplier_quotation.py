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




def set_logistics_warehouse(doc, method=None):
    """
    Auto-set warehouse for Supplier Quotation when custom_type = Logistics.
    Applies to child table: Supplier Quotation Item.
    """

    # Run only for Logistics type quotations
    if doc.custom_type != "Logistics":
        return

    # Fetch company's default temporary warehouse
    temp_wh = frappe.db.get_value(
        "Company",
        doc.company,
        "custom_default_temporary_warehouse"
    )

    if not temp_wh:
        return

    # Loop through items
    for item in doc.items or []:

        # Check each possible field and set only if empty
        if item.meta.has_field("warehouse") and not item.get("warehouse"):
            item.warehouse = temp_wh

        if item.meta.has_field("set_warehouse") and not item.get("set_warehouse"):
            item.set_warehouse = temp_wh

        if item.meta.has_field("custom_warehouse") and not item.get("custom_warehouse"):
            item.custom_warehouse = temp_wh
