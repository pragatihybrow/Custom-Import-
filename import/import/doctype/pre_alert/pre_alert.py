# Copyright (c) 2025, Pragati Dike and contributors
# For license information, please see license.txt


import frappe
from frappe import _
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


# import/import/doctype/pre_alert/pre_alert.py

import frappe

@frappe.whitelist()
def get_pickup_request_details(pickup_name):
    """Fetch Pickup Request details for the given name"""
    
    if not pickup_name:
        return None

    # Get Pickup Request doc
    pickup = frappe.get_doc("Pickup Request", pickup_name)

    # Use correct child table: purchase_order_details
    items = []
    for row in pickup.get("purchase_order_details") or []:
        items.append({
            "item": row.get("item"),
            "material": row.get("material"),
            "material_desc": row.get("material_desc"),
            "pick_qty": row.get("pick_qty"),
            "po_number": row.get("po_number"),
            "rate": row.get("rate") or 0,
            "amount": row.get("amount") or 0,
            "quantity": row.get("quantity") or 0,
            "amount_in_inr": row.get("amount_in_inr") or 0
        })

    # Attachments: if you have a field like attachments, replace this
    attachments = []
    for file in pickup.get("attachments") or []:
        attachments.append({
            "description": file.get("file_name"),
            "attach_file": file.get("file_url")
        })

    return {
        "name": pickup.name,
        "transaction_date": pickup.get("po_date"),  
        "customer": pickup.get("company"),          #
        "status": pickup.get("status") or pickup.get("workflow_state"),
        "items": items,
        "attachments": attachments,
        "currency": pickup.get("currency"),
        "exchange_rate": pickup.get("conversion_rate") or 1
    }



@frappe.whitelist()
def get_available_pickup_requests():
    """
    Get all submitted Pickup Requests that don't have Pre Alerts created yet
    """
    # Get all Pickup Request names that already have Pre Alerts
    existing_pre_alerts = frappe.get_all(
        'Pre Alert',
        filters={'docstatus': ['!=', 2]},  # Exclude cancelled
        fields=['pickup_request']
    )
    
    existing_pickup_requests = [d.pickup_request for d in existing_pre_alerts if d.pickup_request]
    
    # Build filters
    filters = {
        'docstatus': 1,  # Only submitted
    }
    
    # Exclude Pickup Requests that already have Pre Alerts
    if existing_pickup_requests:
        filters['name'] = ['not in', existing_pickup_requests]
    
    # Get available Pickup Requests
    pickup_requests = frappe.get_all(
        'Pickup Request',
        filters=filters,
        fields=[
            'name',
            'total_picked_quantity',
            'grand_total',
            'base_grand_total',
            'currency',
            'conversion_rate'
        ],
        order_by='creation desc'
    )
    
    # Add items count for each pickup request
    for pr in pickup_requests:
        items_count = frappe.db.count(
            'Purchase Order Details',
            filters={'parent': pr.name}
        )
        pr['items_count'] = items_count
    
    return pickup_requests



@frappe.whitelist()
def get_pickup_request_details(pickup_request):
    """
    Get all details from Pickup Request including items and RFQs
    """
    if not pickup_request:
        frappe.throw(_("Pickup Request is required"))
    
    # Get Pickup Request document
    pr_doc = frappe.get_doc('Pickup Request', pickup_request)
    
    # Check if Pre Alert already exists for this Pickup Request
    existing_pre_alert = frappe.db.exists(
        'Pre Alert',
        {
            'pickup_request': pickup_request,
            'docstatus': ['!=', 2]
        }
    )
    
    if existing_pre_alert:
        frappe.msgprint(
            _('A Pre Alert already exists for this Pickup Request: {0}').format(existing_pre_alert),
            indicator='orange'
        )
    
    # ✅ Get all RFQs linked to this Pickup Request
    rfqs = []
    rfq_list = frappe.get_all(
        'Request for Quotation',
        filters={'custom_pickup_request': pickup_request},
        fields=['name']
    )
    for rfq in rfq_list:
        rfqs.append({"request_for_quotation": rfq.name})
    
    # Get Vendor from Supplier Quotation (submitted)
    vendor = None
    sq_list = frappe.get_all(
        'Supplier Quotation',
        filters={
            'custom_pickup_request': pickup_request,
            'docstatus': 1
        },
        fields=['supplier'],
        limit=1
    )
    if sq_list:
        vendor = sq_list[0].supplier
    
    # If vendor not found in Supplier Quotation, try from name_of_supplier in Pickup Request
    if not vendor and pr_doc.get('name_of_supplier') and len(pr_doc.name_of_supplier) > 0:
        vendor = pr_doc.name_of_supplier[0].supplier
    
    # Prepare items data
    items = []
    if pr_doc.get('purchase_order_details'):
        for item in pr_doc.purchase_order_details:
            items.append({
                'item': item.item,
                'material': item.material,
                'material_desc': item.material_desc,
                'pick_qty': item.pick_qty,
                'rate': item.rate,
                'amount': item.amount,
                'amount_in_inr': item.amount_in_inr,
                'po_number': item.po_number,
                'currency': item.currency,
                'currency_rate': item.currency_rate
            })
    
    # ✅ Return all required data including RFQs list
    return {
        'rfqs': rfqs,   # always a list, safe for frontend loop
        'vendor': vendor,
        'currency': pr_doc.get('currency') or 'INR',
        'conversion_rate': pr_doc.get('conversion_rate') or 1.0,
        "total_inr_val": pr_doc.get('base_total') or 0,
        "total_doc_val": pr_doc.get('total') or 0,
        'grand_total': pr_doc.get('grand_total') or 0,
        'base_grand_total': pr_doc.get('base_grand_total') or 0,
        'total_picked_quantity': pr_doc.get('total_picked_quantity') or 0,
        'items': items
    }


@frappe.whitelist()
def validate_pickup_request_pre_alert(pickup_request):
    """
    Validate if a Pre Alert can be created for this Pickup Request
    """
    if not pickup_request:
        return {'valid': False, 'message': 'Pickup Request is required'}
    
    # Check if Pickup Request exists and is submitted
    pr_doc = frappe.db.get_value(
        'Pickup Request',
        pickup_request,
        ['name', 'docstatus'],
        as_dict=True
    )
    
    if not pr_doc:
        return {'valid': False, 'message': 'Pickup Request not found'}
    
    if pr_doc.docstatus != 1:
        return {'valid': False, 'message': 'Pickup Request must be submitted'}
    
    # Check if Pre Alert already exists
    existing_pre_alert = frappe.db.exists(
        'Pre Alert',
        {
            'pickup_request': pickup_request,
            'docstatus': ['!=', 2]
        }
    )
    
    if existing_pre_alert:
        return {
            'valid': False,
            'message': f'Pre Alert already exists: {existing_pre_alert}'
        }
    
    return {'valid': True, 'message': 'Valid for Pre Alert creation'}



@frappe.whitelist()
def get_valid_pickup_requests_for_pre_alert():
    """
    Get all Pickup Requests that have both RFQ and submitted Supplier Quotation
    """
    # Get all submitted Pickup Requests
    pickup_requests = frappe.get_all(
        'Pickup Request',
        filters={'docstatus': 1},
        pluck='name'
    )
    
    valid_pickup_requests = []
    
    for pr_name in pickup_requests:
        # Check if RFQ exists
        rfq_exists = frappe.db.exists(
            'Request for Quotation',
            {'custom_pickup_request': pr_name}
        )
        
        if not rfq_exists:
            continue
        
        # Check if submitted Supplier Quotation exists
        sq_exists = frappe.db.exists(
            'Supplier Quotation',
            {
                'custom_pickup_request': pr_name,
                'docstatus': 1
            }
        )
        
        if sq_exists:
            valid_pickup_requests.append(pr_name)
    
    return valid_pickup_requests