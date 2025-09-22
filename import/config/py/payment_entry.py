


import frappe
from frappe.model.document import Document

def set_custom_fields(doc, method):
    if doc.references and len(doc.references) > 0:
        first_ref = doc.references[0]
        if first_ref.reference_doctype == "Purchase Order" and first_ref.reference_name:
            po = frappe.get_doc("Purchase Order", first_ref.reference_name)
            doc.custom_po_no = first_ref.reference_name
            # doc.custom_pickup_request = po.custom_pickup_request
            

def doc_attachment(doc, method):
    if doc.custom_payment__type == "Import - Custom Duty":
        required_docs = ["Checklist", "Commercial Invoice", "AWB", "PO", "BOE"]
        attached_docs = [d.description for d in doc.custom_document_attachment]

        matched_count = sum(1 for rd in required_docs if rd in attached_docs)

        if matched_count < 3:
            frappe.throw(
                f"At least 3 out of 5 required Document Attachments must be present. "
                f"Currently found: {matched_count}"
            )

def doc_attachment2(doc, method):
    if doc.custom_payment__type == "Import - Custom Duty":
        required_docs = ["Checklist", "Commercial Invoice", "AWB", "PO", "BOE"]
        attached_docs = [d.description for d in doc.custom_document_attachment]

        matched_count = sum(1 for rd in required_docs if rd in attached_docs)

        if matched_count < 4:
            frappe.throw(
                f"At least 4 out of 5 required Document Attachments must be present. "
                f"Currently found: {matched_count}"
            )
