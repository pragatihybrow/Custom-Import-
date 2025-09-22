import frappe
        
        
@frappe.whitelist()
def get_purchase_order_details(doc):
    """
    Fetches and sets purchase order tracking info into Material Request.
    """
    doc = frappe.get_doc(frappe.parse_json(doc))

    # Ensure custom_tracking_status_for_mr is a list and clear previous data if needed
    if not hasattr(doc, "custom_tracking_status_for_mr"):
        doc.set("custom_tracking_status_for_mr", [])

    # Helper: index existing rows for quick lookup
    existing_rows = {}
    for row in doc.custom_tracking_status_for_mr:
        key = (row.purchase_order, row.item_code)
        existing_rows[key] = row

    for item in doc.get("items", []):
        material_request_item = item.get("name")
        if not material_request_item:
            continue

        item_code = item.get("item_code")

        # Get all PO Items linked to this MR Item
        po_items = frappe.get_all(
            "Purchase Order Item",
            filters={"material_request_item": material_request_item},
            fields=["parent", "qty", "received_qty"]
        )

        for po_item in po_items:
            key = (po_item.parent, item_code)

            po_qty = float(po_item.qty)
            grn_qty = float(po_item.received_qty)
            pending_qty = po_qty - grn_qty

            if key in existing_rows:
                # Update existing row
                row = existing_rows[key]
                row.purchase_order_qty = po_qty
                row.grn_qty = grn_qty
                row.po_pending_qty = pending_qty
            else:
                # Append new row
                doc.append("custom_tracking_status_for_mr", {
                    "purchase_order": po_item.parent,
                    "purchase_order_qty": po_qty,
                    "grn_qty": grn_qty,
                    "po_pending_qty": pending_qty,
                    "item_code": item_code,
                    "items_row_id": material_request_item
                })

    doc.save(ignore_permissions=True)
    return "Updated"
