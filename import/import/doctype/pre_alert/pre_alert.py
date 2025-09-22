# Copyright (c) 2025, Pragati Dike and contributors
# For license information, please see license.txt


import frappe
from frappe.model.document import Document
from frappe import msgprint, sendmail
from frappe.email.queue import flush
import os

class PreAlert(Document):
    pass


@frappe.whitelist()
def get_percentage_of_hsn_and_category_base(name, category):
    data = frappe.db.sql(
        " select * from `tabApplication Bond Duty Details` where parent=%s and category=%s ",
        (name, category),
        as_dict=True,
    )
    return data


@frappe.whitelist()
def get_exchange_rate(name):
    data = frappe.db.sql(
        " select exchange_rate,currency from `tabPurchase Order List` where parent=%s",
        (name),
        as_dict=True,
    )
    items_data = frappe.db.sql(
        " select * from `tabPurchase Order Details` where parent=%s ",
        (name),
        as_dict=True,
    )

    return data, items_data


@frappe.whitelist()
def get_attachments(name):
    data = frappe.db.sql(
        " select * from `tabAttach Document` where parent=%s  ", (name), as_dict=True
    )

    return data


@frappe.whitelist()
def update_rodtep(name, use_rodtep):
    data = frappe.db.sql(
        " select remaining_amount from `tabRodtep Utilization` where name=%s ",
        (name),
        as_dict=True,
    )

    remaining_rodtep = float(data[0]["remaining_amount"]) - float(use_rodtep)

    frappe.set_value("Rodtep Utilization", name, "remaining_amount", remaining_rodtep)
    if remaining_rodtep == 0:
        frappe.set_value("Rodtep Utilization", name, "status", "Use")


@frappe.whitelist()
def send_mail_to_cha(cha_name, doc_name):
    import pandas as pd
    # Fetch recipient emails
    recever = frappe.db.sql(
        """
            SELECT ct.email_id 
            FROM `tabContact` AS ct
            LEFT JOIN `tabDynamic Link` AS dl ON ct.name = dl.parent
            WHERE dl.link_doctype = 'Supplier' AND dl.link_name = %s
        """,
        (cha_name,),
        as_dict=True,
    )
    
    recipient = [row["email_id"] for row in recever if row["email_id"]]

    if not recipient:
        frappe.throw("No email found for the CHA.")

    # Fetch the document
    doc = frappe.get_doc("Pre Alert", doc_name)

    # Check if doc contains item_details
    if not doc.item_details:
        frappe.throw("No item details found in the document.")

    # Prepare data for Excel
    data = [
        {
            "PO No": row.po_no,
            "Item Code": row.item_code,
            "Description": row.description,
            "Quantity": row.quantity,
            "Item Price": row.item_price,
            "Amount": row.amount,
            "Total INR Value": row.total_inr_value,
            "Freight Amount": row.freight_amount,
            "Insurance Amount": row.insurance_amount,
            "Misc Charge Amount": row.misc_charge_amt,
            "Total Amount": row.total_amount,
            "BCD (%)": row.bcd_,
            "BCD Amount": row.bcd_amount,
            "HCS (%)": row.hcs_,
            "HCS Amount": row.hcs_amount,
            "SWL (%)": row.swl_,
            "SWL Amount": row.swl_amount,
            "Total Duty": row.total_duty,
            "IGST (%)": row.igst_,
            "IGST Amount": row.igst_amount,
            "Final Total Duty": row.final_total_duty,
            "exch_rate": doc.exch_rate,
        }
        for row in doc.item_details
    ]

    # Convert to DataFrame
    df = pd.DataFrame(data)

    # Define file path
    file_name = f"Pre_Alert_{doc_name}.xlsx"
    file_path = os.path.join(frappe.get_site_path("private", "files"), file_name)

    # Save Excel file
    df.to_excel(file_path, index=False)

    # Attach file to email
    with open(file_path, "rb") as f:
        file_data = f.read()

    file_doc = frappe.get_doc(
        {
            "doctype": "File",
            "file_name": file_name,
            "is_private": 1,
            "content": file_data,
        }
    )
    file_doc.save(ignore_permissions=True)

    # Fetch email template
    email_template = frappe.get_doc("Email Template", "CHA Notification Template")

    # Prepare context for email rendering
    context = {
        "doc": {
            "cha": doc.cha if hasattr(doc, "cha") else cha_name,
        }
    }

    # Render email
    subject = frappe.render_template(email_template.subject, context)
    message = frappe.render_template(email_template.response_html, context)

    # Send email with attachment
    frappe.sendmail(
        recipients=recipient,
        subject=subject,
        message=message,
        attachments=[{"fname": file_name, "fcontent": file_data}],
        now=True,
    )

    return "Email sent successfully with Excel attachment."

