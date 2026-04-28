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
        filters={
            "purchase_order": ["in", po_nos],
            "parenttype": "Payment Requisition"
        },
        fields=["parent"],
        ignore_permissions=True
    )

    if not linked_prs:
        frappe.msgprint("No Payment Requisitions found for linked POs")
        return

    pr_names = list(set([r.parent for r in linked_prs]))

    for pr_name in pr_names:
        pr_doc = frappe.get_doc("Payment Requisition", pr_name)

        # Set all fields directly on the doc
        pr_doc.bill_of_entry_created = 1
        pr_doc.boe_no = doc.name
        pr_doc.boe_date = doc.boe_date
        pr_doc.bcd = doc.bcd_amount
        pr_doc.igst = doc.igst_amount
        pr_doc.cha = doc.cha
        pr_doc.total = doc.igst_amount + doc.bcd_amount + doc.h_cess_amount + doc.sws_amount
        pr_doc.assessable_value = doc.accessible_value
        pr_doc.health_cess = doc.h_cess_amount
        pr_doc.penalty = doc.penalty
        pr_doc.sw_surcharge = doc.sws_amount
        pr_doc.job_no = doc.job_number
        pr_doc.duty_amount = doc.igst_amount + doc.bcd_amount + doc.h_cess_amount + doc.sws_amount
        pr_doc.boe_number = doc.boe_number

        # Attach BOE file if not already attached
        if doc.attach_boe:
            already_attached = any(
                row.description == "BOE" and row.attach_file == doc.attach_boe
                for row in pr_doc.attach_document
            )
            if not already_attached:
                pr_doc.append("attach_document", {
                    "description": "BOE",
                    "attach_file": doc.attach_boe
                })

        # ✅ Save the full doc — commits everything to DB properly
        pr_doc.flags.ignore_permissions = True
        pr_doc.flags.ignore_validate = True  # skip unnecessary validations
        pr_doc.save()

        frappe.db.commit()  # ensure changes are committed before redirect

    # Store PR name for client-side redirect
    frappe.db.set_value("BOE", doc.name, "payment_requisition", pr_names[0])
    doc.payment_requisition = pr_names[0]



# def update_payment_request(doc, method):
#     # Step 1: Extract PO numbers from BOE child table
#     po_nos = [po_row.purchase_order for po_row in doc.po_no if po_row.purchase_order]
#     if not po_nos:
#         frappe.msgprint("No Purchase Orders found in BOE")
#         return

#     # Step 2: Find Payment Requisitions linked via child table 'PO CT'
#     # IMPORTANT: filter by parenttype to avoid matching other doctypes (e.g. Pickup Request)
#     linked_prs = frappe.get_all(
#         "PO CT",
#         filters={
#             "purchase_order": ["in", po_nos],
#             "parenttype": "Payment Requisition"
#         },
#         fields=["parent"]
#     )

#     if not linked_prs:
#         frappe.msgprint("No Payment Requisitions found for linked POs")
#         return

#     pr_names = list(set([r.parent for r in linked_prs]))

#     # Step 3: Update each matching Payment Requisition
#     for pr_name in pr_names:
#         frappe.db.set_value("Payment Requisition", pr_name, {
#             "bill_of_entry_created": 1,
#             "boe_no": doc.name,
#             "boe_date": doc.boe_date,
#             "bcd": doc.bcd_amount,
#             "igst": doc.igst_amount,
#             "cha": doc.cha,
#             "total": (doc.igst_amount + doc.bcd_amount + doc.h_cess_amount + doc.sws_amount),
#             "assessable_value": doc.accessible_value,
#             "health_cess": doc.h_cess_amount,
#             "penalty": doc.penalty,
#             "sw_surcharge": doc.sws_amount,
#             "job_no": doc.job_number,
#             "duty_amount": (doc.igst_amount + doc.bcd_amount + doc.h_cess_amount + doc.sws_amount),
#             "boe_number": doc.boe_number
#         })

#         # Step 4: Attach BOE file to Payment Requisition's Attach Document child table
#         if doc.attach_boe:
#             pr_doc = frappe.get_doc("Payment Requisition", pr_name)

#             # Check if a BOE entry already exists to avoid duplicates
#             already_attached = any(
#                 row.description == "BOE" and row.attach_file == doc.attach_boe
#                 for row in pr_doc.attach_document
#             )

#             if not already_attached:
#                 pr_doc.append("attach_document", {
#                     "description": "BOE",
#                     "attach_file": doc.attach_boe
#                 })
#                 pr_doc.flags.ignore_permissions = True
#                 pr_doc.save()