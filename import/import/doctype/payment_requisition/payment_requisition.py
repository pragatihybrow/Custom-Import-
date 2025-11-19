# Copyright (c) 2025, Pragati Dike
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils.data import money_in_words
from frappe.utils import formatdate


class PaymentRequisition(Document):
    def validate(self):
        """Validation before save"""
        self.check_duplicate_pickup_request()
        self.doc_attachment()
        self.doc_attachment2()

    def on_submit(self):
        """On Submit actions"""
        self.mark_pickup_request_processed()
        self.create_customs_duty_journal_entry()
        self.send_mail()

        

    def on_cancel(self):
        """On Cancel actions"""
        self.unmark_pickup_request_processed()

    # def after_submit(self):
    #     self.send_mail()


    # ---------------- Helper Methods ---------------- #
    def send_mail(self):
        """Send formatted email when Payment Requisition is submitted."""

        if not self.name:
            return

        from frappe.utils import formatdate, fmt_money, get_url_to_form

        # Format PO/WO and supplier values
        po_wo_no = ", ".join([row.purchase_order for row in self.po_wono]) if getattr(self, "po_wono", None) else ""
        supplier_names = ", ".join([row.supplier for row in self.supplier_name]) if getattr(self, "supplier_name", None) else ""
        po_wo_date = formatdate(self.get("po_date") or frappe.utils.nowdate(), "dd/MM/yyyy")

        # Get all users with Accounts Manager role
        accounts_manager_users = [
            d.parent for d in frappe.get_all("Has Role", filters={"role": "Accounts Manager"}, fields=["parent"])
        ]
        recipients = [
            u.email for u in frappe.get_all(
                "User",
                filters={"name": ["in", accounts_manager_users], "enabled": 1},
                fields=["email"]
            ) if u.email
        ]

        subject = f"Payment Request No : {self.name} | Kindly release payment"

        # Proper HTML table with inline CSS
        message = f"""
        <p>Dear Sir/Ma'am,</p>
        <p>Kindly release the payment as per below request.</p>
        <table style="border-collapse: collapse; width: auto; font-family: Arial, sans-serif;">
            <tr><td style="border:1px solid #ccc; padding:6px;"><b>Payment Request No :</b></td><td style="border:1px solid #ccc; padding:6px;">{self.name}</td></tr>
            <tr><td style="border:1px solid #ccc; padding:6px;"><b>Payment Request Date :</b></td><td style="border:1px solid #ccc; padding:6px;">{formatdate(self.creation, "dd/MM/yyyy")}</td></tr>
            <tr><td style="border:1px solid #ccc; padding:6px;"><b>Favoring Of :</b></td><td style="border:1px solid #ccc; padding:6px;">{self.favoring_of or ''}</td></tr>
            <tr><td style="border:1px solid #ccc; padding:6px;"><b>Country of Origin :</b></td><td style="border:1px solid #ccc; padding:6px;">{self.consignment or ''}</td></tr>
            <tr><td style="border:1px solid #ccc; padding:6px;"><b>Country Of Consignment :</b></td><td style="border:1px solid #ccc; padding:6px;">{self.consignment or ''}</td></tr>
            <tr><td style="border:1px solid #ccc; padding:6px;"><b>Mode Of Shipment :</b></td><td style="border:1px solid #ccc; padding:6px;">{self.mode_of_shipment or ''}</td></tr>
            <tr><td style="border:1px solid #ccc; padding:6px;"><b>Payable At :</b></td><td style="border:1px solid #ccc; padding:6px;">{self.payable_at or ''}</td></tr>
            <tr><td style="border:1px solid #ccc; padding:6px;"><b>Payment By :</b></td><td style="border:1px solid #ccc; padding:6px;">{self.payment_by or ''}</td></tr>
            <tr><td style="border:1px solid #ccc; padding:6px;"><b>Payment Required :</b></td><td style="border:1px solid #ccc; padding:6px;">{self.payment_required or ''}</td></tr>
            <tr><td style="border:1px solid #ccc; padding:6px;"><b>PO/WO No :</b></td><td style="border:1px solid #ccc; padding:6px;">{po_wo_no}</td></tr>
            <tr><td style="border:1px solid #ccc; padding:6px;"><b>PO/WO Date :</b></td><td style="border:1px solid #ccc; padding:6px;">{po_wo_date}</td></tr>
            <tr><td style="border:1px solid #ccc; padding:6px;"><b>CHA :</b></td><td style="border:1px solid #ccc; padding:6px;">{self.cha or ''}</td></tr>
            <tr><td style="border:1px solid #ccc; padding:6px;"><b>Material Type :</b></td><td style="border:1px solid #ccc; padding:6px;">{self.type_of_materials or ''}</td></tr>
            <tr><td style="border:1px solid #ccc; padding:6px;"><b>Supplier Name :</b></td><td style="border:1px solid #ccc; padding:6px;">{supplier_names}</td></tr>
            <tr><td style="border:1px solid #ccc; padding:6px;"><b>Amount :</b></td><td style="border:1px solid #ccc; padding:6px;">{fmt_money(self.duty_amount)}</td></tr>
            <tr><td style="border:1px solid #ccc; padding:6px;"><b>Amount in Words :</b></td><td style="border:1px solid #ccc; padding:6px;">{self.duty_amount_in_word or ''}</td></tr>
            <tr><td style="border:1px solid #ccc; padding:6px;"><b>Job No :</b></td><td style="border:1px solid #ccc; padding:6px;">{self.job_no or ''}</td></tr>
            <tr><td style="border:1px solid #ccc; padding:6px;"><b>Special Remark :</b></td><td style="border:1px solid #ccc; padding:6px;">{self.specific_remark or ''}</td></tr>
        </table>
        <br>
        <p>Please click the below link for more details:</p>
        <p><a href="{get_url_to_form('Journal Entry', self.journal_entry)}" target="_blank">View Journal Entry</a></p>
        <br>
        <p>Thanking you,<br>{frappe.session.user_fullname}</p>
        """

        frappe.sendmail(
            recipients=recipients,
            subject=subject,
            message=message,
            delayed=False,
            reference_doctype=self.doctype,
            reference_name=self.name,
        )

        frappe.msgprint("📨 Email notification sent successfully to Accounts Manager(s).")


    def check_duplicate_pickup_request(self):
        """Ensure only one Payment Requisition exists per Pickup Request"""
        if self.pickup_request:
            existing = frappe.get_all(
                'Payment Requisition',
                filters={
                    'pickup_request': self.pickup_request,
                    'docstatus': ['!=', 2],  # Not cancelled
                    'name': ['!=', self.name]  # Exclude current document
                },
                fields=['name']
            )
            if existing:
                frappe.throw(
                    _('Payment Requisition {0} already exists for Pickup Request {1}').format(
                        existing[0].name, self.pickup_request
                    )
                )

    def mark_pickup_request_processed(self):
        """Mark the linked Pickup Request as processed"""
        if self.pickup_request:
            frappe.db.set_value('Pickup Request', self.pickup_request, 'po_updated', 1)
            frappe.msgprint(_('Pickup Request {0} has been marked as processed').format(self.pickup_request))

    def unmark_pickup_request_processed(self):
        """Unmark the linked Pickup Request when cancelled"""
        if self.pickup_request:
            frappe.db.set_value('Pickup Request', self.pickup_request, 'po_updated', 0)
            frappe.msgprint(_('Pickup Request {0} has been unmarked').format(self.pickup_request))

    def doc_attachment(self):
        """Validate minimum 3 required documents attached before saving"""
        required_docs = ["Checklist", "Commercial Invoice", "AWB", "PO", "BOE"]
        attached_docs = [d.description for d in self.attach_document]

        matched_count = sum(1 for rd in required_docs if rd in attached_docs)

        if matched_count < 3:
            frappe.throw(
                f"At least 3 out of 5 required Document Attachments must be present. "
                f"Currently found: {matched_count}"
            )

    def doc_attachment2(self):
        """Validate minimum 4 required documents attached before submitting"""
        if self.workflow_state == "Sent For Account Team Approval":
            required_docs = ["Checklist", "Commercial Invoice", "AWB", "PO", "BOE"]
            attached_docs = [d.description for d in self.attach_document]

            matched_count = sum(1 for rd in required_docs if rd in attached_docs)

            if matched_count < 4:
                frappe.throw(
                    f"At least 4 out of 5 required Document Attachments must be present. "
                    f"Currently found: {matched_count}"
                )
    
    # def create_customs_duty_journal_entry(self):
    #     """Auto-create a Journal Entry for Customs Duty on submit"""
    #     from frappe.utils import flt, nowdate
    #     import frappe
    #     from frappe import _

    #     total_customs_duty = (
    #         flt(self.bcd)
    #         + flt(self.igst)
    #         + flt(self.health_cess)
    #         + flt(self.sw_surcharge)
    #     )

    #     if total_customs_duty <= 0:
    #         frappe.msgprint(_("No Customs Duty amount found, Journal Entry not created."))
    #         return

    #     # Get company details
    #     company = frappe.get_doc("Company", self.company)
    #     company_abbr = company.abbr

    #     # Fetch accounts from company defaults
    #     customs_duty_expense_account = f"Customs Duty Expense - {company_abbr}"

    #     # ✅ Get Payable Account dynamically from Company custom field
    #     duty_payable_account = company.default_customs_expense_account

    #     if not duty_payable_account:
    #         frappe.throw(_("Please set 'Default Customs Expense Account' in Company {0}.").format(self.company))

    #     # Get account type of payable account
    #     account_type = frappe.db.get_value("Account", duty_payable_account, "account_type")

    #     # Build comma-separated PO numbers (if available)
    #     po_list = []
    #     if hasattr(self, "po_wono") and self.po_wono:
    #         po_list = [d.purchase_order for d in self.po_wono if d.purchase_order]
    #     po_numbers = ", ".join(po_list) if po_list else "N/A"

    #     # Create Journal Entry
    #     je = frappe.new_doc("Journal Entry")
    #     je.voucher_type = "Journal Entry"
    #     je.posting_date = nowdate()
    #     je.custom_payment_requisition = self.name
    #     je.company = self.company
    #     je.user_remark = (
    #         f"Being Duty payable against {self.name}, Job No. {self.job_no or ''}, "
    #         f"PO No. {po_numbers}, BE No. {self.boe_no or ''} Dt. {self.boe_date or ''}"
    #     )
    #     je.cheque_no = self.name
    #     je.cheque_date = self.posting_date

    #     # Debit - Customs Duty Expense
    #     # je.append("accounts", {
    #     #     "account": customs_duty_expense_account,
    #     #     "debit_in_account_currency": total_customs_duty,
    #     #     "cost_center": getattr(self, "cost_center", None),
    #     # })
    #     # ✅ Split IGST into a separate line if applicable
    #     igst_amount = flt(self.igst)
    #     other_duties = flt(self.bcd) + flt(self.health_cess) + flt(self.sw_surcharge)

    #     # Debit - Customs Duty Expense (excluding IGST)
    #     if other_duties > 0:
    #         je.append("accounts", {
    #             "account": customs_duty_expense_account,
    #             "debit_in_account_currency": other_duties,
    #             "cost_center": getattr(self, "cost_center", None),
    #         })

    #     # Debit - IGST Expense (separate line)
    #     if igst_amount > 0:
    #         # igst_account = customs_duty_expense_accoun
    #         je.append("accounts", {
    #             "account": customs_duty_expense_account,
    #             "debit_in_account_currency": igst_amount,
    #             "cost_center": getattr(self, "cost_center", None),
    #         })


    #     # Credit - Customs Duty Payable
    #     credit_entry = {
    #         "account": duty_payable_account,
    #         "credit_in_account_currency": total_customs_duty,
    #     }

    #     # ✅ Set CHA as party if available
    #     if getattr(self, "cha", None):
    #         credit_entry.update({
    #             "party_type": "Supplier",
    #             "party": self.cha
    #         })
    #     elif account_type == "Payable" and getattr(self, "supplier_name", None):
    #         # fallback in case CHA is not set
    #         credit_entry.update({
    #             "party_type": "Supplier",
    #             "party": self.supplier_name
    #         })

    #     je.append("accounts", credit_entry)

    #     je.insert(ignore_permissions=True)
    #     # je.submit()

    #     # Optionally store JE reference
    #     self.db_set("journal_entry", je.name)

    #     frappe.msgprint(
    #         f"✅ Journal Entry <a href='/app/journal-entry/{je.name}'>{je.name}</a> created for Customs Duty."
    #     )


    def create_customs_duty_journal_entry(self):
        """Auto-create a Journal Entry for Customs Duty on submit"""
        from frappe.utils import flt, nowdate
        import frappe
        from frappe import _

        total_customs_duty = (
            flt(self.bcd)
            + flt(self.igst)
            + flt(self.health_cess)
            + flt(self.sw_surcharge)
        )

        if total_customs_duty <= 0:
            frappe.msgprint(_("No Customs Duty amount found, Journal Entry not created."))
            return

        # Get company details
        company = frappe.get_doc("Company", self.company)
        company_abbr = company.abbr

        # Fetch accounts
        customs_duty_expense_account = f"Customs Duty Expense - {company_abbr}"

        # Get Payable Account dynamically from Company
        duty_payable_account = company.default_customs_expense_account
        if not duty_payable_account:
            frappe.throw(_("Please set 'Default Customs Expense Account' in Company {0}.").format(self.company))

        account_type = frappe.db.get_value("Account", duty_payable_account, "account_type")

        # Build comma-separated PO numbers
        po_list = []
        if hasattr(self, "po_wono") and self.po_wono:
            po_list = [d.purchase_order for d in self.po_wono if d.purchase_order]
        po_numbers = ", ".join(po_list) if po_list else "N/A"

        # Fetch port code from Pickup Request
        port_code = None
        if getattr(self, "pickup_request", None):
            port_code = frappe.db.get_value("Pickup Request", self.pickup_request, "port_of_destination_pod")

        # Create Journal Entry
        je = frappe.new_doc("Journal Entry")
        je.voucher_type = "Journal Entry"
        je.posting_date = nowdate()
        je.custom_payment_requisition = self.name
        je.company = self.company
        je.user_remark = (
            f"Being Duty payable against {self.name}, Job No. {self.job_no or ''}, "
            f"PO No. {po_numbers}, BE No. {self.boe_no or ''} Dt. {self.boe_date or ''}"
        )
        je.cheque_no = self.name
        je.cheque_date = self.posting_date

        # Duty Splits
        igst_amount = flt(self.igst)
        other_duties = flt(self.bcd) + flt(self.health_cess) + flt(self.sw_surcharge)

        # ---------------------------
        # Debit Entry – Other Duties
        # ---------------------------
        if other_duties > 0:
            je.append("accounts", {
                "account": customs_duty_expense_account,
                "debit_in_account_currency": other_duties,
                "cost_center": getattr(self, "cost_center", None),
                "custom_bill_of_entry_no": self.boe_no,
                "custom_bill_of_entry_date": self.boe_date,
                "custom_port_code": port_code
            })

        # ---------------------------
        # Debit Entry – IGST
        # ---------------------------
        if igst_amount > 0:
            je.append("accounts", {
                "account": customs_duty_expense_account,
                "debit_in_account_currency": igst_amount,
                "cost_center": getattr(self, "cost_center", None),
                "custom_bill_of_entry_no": self.boe_no,
                "custom_bill_of_entry_date": self.boe_date,
                "custom_port_code": port_code
            })

        # ---------------------------
        # Credit Entry – Duty Payable
        # ---------------------------
        credit_entry = {
            "account": duty_payable_account,
            "credit_in_account_currency": total_customs_duty,
        }

        # Set Supplier / CHA
        if getattr(self, "cha", None):
            credit_entry.update({
                "party_type": "Supplier",
                "party": self.cha
            })
        elif account_type == "Payable" and getattr(self, "supplier_name", None):
            credit_entry.update({
                "party_type": "Supplier",
                "party": self.supplier_name
            })

        # Add BOE + Port details
        credit_entry.update({
            "custom_bill_of_entry_no": self.boe_no,
            "custom_bill_of_entry_date": self.boe_date,
            "custom_port_code": port_code
        })

        je.append("accounts", credit_entry)

        # Save JE
        je.insert(ignore_permissions=True)
        # je.submit()

        # Store JE reference
        self.db_set("journal_entry", je.name)

        frappe.msgprint(
            f"✅ Journal Entry <a href='/app/journal-entry/{je.name}'>{je.name}</a> created for Customs Duty."
        )

# ---------------- Whitelisted Methods ---------------- #

@frappe.whitelist()
def get_amount_in_words(amount):
    """Convert numeric amount to words"""
    try:
        return money_in_words(amount)
    except Exception as e:
        frappe.log_error(f"Money in words error: {str(e)}", "Payment Requisition")
        return ""


@frappe.whitelist()
def get_available_pickup_requests():
    """Get list of Pickup Requests that don't have a Payment Requisition yet"""
    try:
        pickup_requests = frappe.get_all(
            'Pickup Request',
            filters={
                'docstatus': 1,  # Submitted
                # 'po_updated': 0  # Uncomment if you only want unprocessed ones
            },
            fields=[
                'name',
                'po_date',
                'company',
                'incoterm',
                'mode_of_shipment',
                'grand_total',
                'currency',
                'country_origin',
                'port_of_loading_pol',
                'port_of_destination_pod'
            ],
            order_by='creation desc'
        )
        return pickup_requests
    except Exception:
        frappe.log_error(frappe.get_traceback(), 'Get Available Pickup Requests Error')
        frappe.throw(_('Error fetching Pickup Requests'))


@frappe.whitelist()
def get_pickup_request_details(pickup_request):
    """Fetch supplier and PO details from Pickup Request"""
    if not pickup_request:
        frappe.throw(_('Pickup Request is required'))

    pr_doc = frappe.get_doc("Pickup Request", pickup_request)

    po_list = []
    if hasattr(pr_doc, "po_no") and pr_doc.po_no:
        for po in pr_doc.po_no:
            if po.purchase_order:
                po_list.append({"purchase_order": po.purchase_order})

    data = {
        "name": pr_doc.name,
        "supplier_name": getattr(pr_doc, "name_of_supplier", ""),
        "po_date": getattr(pr_doc, "po_date", None),
        "mode_of_shipment": getattr(pr_doc, "mode_of_shipment", ""),
        "country_origin": getattr(pr_doc, "country_origin", ""),
        "po_list": po_list,
        "company":pr_doc.company,
        "mode_of_shipment":pr_doc.mode_of_shipment
    }

    return data


@frappe.whitelist()
def validate_pickup_request(pickup_request):
    """Check if a Payment Requisition already exists for this Pickup Request"""
    if not pickup_request:
        return {'exists': False}

    try:
        existing = frappe.get_all(
            'Payment Requisition',
            filters={
                'pickup_request': pickup_request,
                'docstatus': ['!=', 2]  # Not cancelled
            },
            fields=['name'],
            limit=1
        )

        if existing:
            return {
                'exists': True,
                'payment_requisition': existing[0].name
            }
        return {'exists': False}
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), 'Validate Pickup Request Error')
        return {'exists': False, 'error': str(e)}


