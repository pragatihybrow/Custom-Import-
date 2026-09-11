
// Copyright (c) 2026, Pragati Dike and contributors
// For license information, please see license.txt

frappe.ui.form.on("Vendor Payment Form", {
    refresh(frm) {
        attach_send_back_handler(frm);

        if (frm.doc.remark) {
            frm.add_custom_button("Send correction mail", function () {
                frappe.confirm(
                    `Send correction mail to supplier for this Vendor Payment Form?`,
                    function () {
                        frappe.call({
                            method: "import.import.doctype.vendor_payment_form.vendor_payment_form.send_vendor_payment_correction_mail",
                            args: {
                                vendor_payment_form_name: frm.doc.name
                            },
                            freeze: true,
                            freeze_message: __("Sending correction mail to vendor..."),
                            callback: function (r) {
                                if (!r.exc) {
                                    frappe.msgprint({
                                        title: __("Email Sent"),
                                        message: __("Correction mail has been sent successfully"),
                                        indicator: "green"
                                    });
                                }
                            }
                        });
                    }
                );
            });
        }
    }
});

function attach_send_back_handler(frm) {
    setTimeout(() => {
        let $btn = frm.page.wrapper
            .find('.page-actions')
            .find('a, button, li, span')
            .filter(function () {
                return $(this).text().trim() === "Send Back for Correction";
            });

        if ($btn.length === 0) {
            setTimeout(() => attach_send_back_handler(frm), 1000);
            return;
        }

        $btn.off('click').on('click', function (e) {
            e.preventDefault();
            e.stopImmediatePropagation();
            show_send_back_dialog(frm);
            return false;
        });
    }, 800);
}

function show_send_back_dialog(frm) {
    let d = new frappe.ui.Dialog({
        title: 'Send Back for Correction',
        fields: [
            {
                label: 'Reason for Sending Back',
                fieldname: 'reason',
                fieldtype: 'Small Text',
                reqd: 1
            }
        ],
        primary_action_label: 'Submit',
        primary_action(values) {
            frm.set_value('remark', values.reason);

            frm.save().then(() => {
                frappe.call({
                    method: "frappe.model.workflow.apply_workflow",
                    args: {
                        doc: frm.doc,
                        action: "Send Back for Correction"
                    },
                    callback: function (r) {
                        if (r.message) {
                            frappe.show_alert({ message: 'Sent back for correction', indicator: 'orange' });
                            frm.reload_doc();
                        }
                    }
                });
            });
            d.hide();
        }
    });
    d.show();
}