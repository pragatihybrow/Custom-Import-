
# import frappe

# def update_payment_request(doc, method):
    
#     for item in doc.boe_entries:
#         if not item.po_number:
#             continue

#         payment_requests = frappe.get_all(
#             "Payment Requisition",
#             filters={
#                 "po_no": doc.po_no
#             },
#             fields=["name", "bill_of_entry_created"]
#         )


#         for pr in payment_requests:
#             frappe.db.set_value("Payment Requisition", pr.name, "bill_of_entry_created", 1)
#             frappe.db.set_value("Payment Requisition", pr.name, "boe_no", doc.name)
#             frappe.db.set_value("Payment Requisition", pr.name, "boe_date", doc.boe_date)
#             frappe.db.set_value("Payment Requisition", pr.name, "bcd", doc.bcd_amount)
#             frappe.db.set_value("Payment Requisition", pr.name, "igst", doc.igst_amount)
#             frappe.db.set_value("Payment Requisition", pr.name, "cha",doc.cha )
#             frappe.db.set_value("Payment Requisition", pr.name, "total", (doc.igst_amount + doc.bcd_amount))
#             frappe.db.set_value("Payment Requisition", pr.name, "assessable_value",doc.accessible_value )
#             frappe.db.set_value("Payment Requisition", pr.name, "health_cess",doc.h_cess_amount )
#             frappe.db.set_value("Payment Requisition", pr.name, "penalty",doc.penalty )
#             frappe.db.set_value("Payment Requisition", pr.name, "surcharge",doc.sws_amount )
#             # frappe.db.set_value("Payment Requisition", pr.name, "deferred_duty_amt",doc.total_duty )
#             frappe.db.set_value("Payment Requisition", pr.name, "job_no",doc.job_number )



           

#             # frappe.msgprint(f"[DEBUG] Updated {pr.name} → custom_bill_of_entry_created=1")


import frappe

def update_payment_request(doc, method):
    # Step 1: Extract PO numbers from BOE child table
    po_nos = [po_row.purchase_order for po_row in doc.po_no if po_row.purchase_order]
    if not po_nos:
        frappe.msgprint("No Purchase Orders found in BOE")
        return

    # Step 2: Find Payment Requisitions linked via child table 'PO CT'
    linked_prs = frappe.get_all(
        "PO CT",
        filters={"purchase_order": ["in", po_nos]},
        fields=["parent"]
    )

    if not linked_prs:
        frappe.msgprint("No Payment Requisitions found for linked POs")
        return

    pr_names = list(set([r.parent for r in linked_prs]))

    # Step 3: Update each matching Payment Requisition
    for pr_name in pr_names:
        frappe.db.set_value("Payment Requisition", pr_name, {
            "bill_of_entry_created": 1,
            "boe_no": doc.name,
            "boe_date": doc.boe_date,
            "bcd": doc.bcd_amount,
            "igst": doc.igst_amount,
            "cha": doc.cha,
            "total": (doc.igst_amount + doc.bcd_amount+doc.h_cess_amount + doc.sws_amount),
            "assessable_value": doc.accessible_value,
            "health_cess": doc.h_cess_amount,
            "penalty": doc.penalty,
            "sw_surcharge": doc.sws_amount,
            "job_no": doc.job_number,
            "duty_amount":(doc.igst_amount + doc.bcd_amount+doc.h_cess_amount + doc.sws_amount)
        })

    # frappe.msgprint(f"Updated {len(pr_names)} Payment Requisition(s) linked to this BOE.")
