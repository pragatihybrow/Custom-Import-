
import frappe

def update_payment_request(doc, method):
    
    for item in doc.boe_entries:
        if not item.po_number:
            continue

        payment_requests = frappe.get_all(
            "Payment Entry",
            filters={
                "custom_po_no": doc.po_no
            },
            fields=["name", "custom_bill_of_entry_created"]
        )


        for pr in payment_requests:
            frappe.db.set_value("Payment Entry", pr.name, "custom_bill_of_entry_created", 1)
            frappe.db.set_value("Payment Entry", pr.name, "custom_boe_no", doc.name)
            frappe.db.set_value("Payment Entry", pr.name, "custom_boe_date", doc.boe_date)
            frappe.db.set_value("Payment Entry", pr.name, "custom_bcd", doc.bcd_amount)
            frappe.db.set_value("Payment Entry", pr.name, "custom_igst", doc.igst_amount)
            frappe.db.set_value("Payment Entry", pr.name, "custom_cha",doc.cha )
            frappe.db.set_value("Payment Entry", pr.name, "custom_total", (doc.igst_amount + doc.bcd_amount))
            frappe.db.set_value("Payment Entry", pr.name, "custom_assessable_value",doc.accessible_value )
            frappe.db.set_value("Payment Entry", pr.name, "custom_health_cess",doc.h_cess_amount )
            frappe.db.set_value("Payment Entry", pr.name, "custom_penalty",doc.penalty )
            frappe.db.set_value("Payment Entry", pr.name, "custom_sw_surcharge",doc.sws_amount )
            # frappe.db.set_value("Payment Entry", pr.name, "custom_deferred_duty_amt",doc.total_duty )
            frappe.db.set_value("Payment Entry", pr.name, "custom_job_no",doc.job_number )



           

            # frappe.msgprint(f"[DEBUG] Updated {pr.name} → custom_bill_of_entry_created=1")
