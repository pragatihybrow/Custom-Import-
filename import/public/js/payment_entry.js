frappe.ui.form.on("Payment Entry", {
    refresh: function (frm) {
        if (
            frm.doc.workflow_state == "Create Bill Of Entry" &&
            frm.doc.docstatus == 0 &&
            frm.doc.custom_trade_category === "Import" &&
            frm.doc.custom_payment__type === "Import - Custom Duty" &&
            frm.doc.custom_bill_of_entry_created !== 1 &&
            frm.doc.references?.length > 0
        ) {
            let first_ref = frm.doc.references[0];
            if (first_ref.reference_doctype === "Purchase Order" && first_ref.reference_name) {
                frappe.db.get_value("Purchase Order", first_ref.reference_name, "gst_category")
                    .then(r => {
                        // if (r?.message?.gst_category === "Overseas") {
                            frm.add_custom_button(
                                __("Bill Of Entry"),
                                function () {
                                    frappe.model.open_mapped_doc({
                                        method: "import.import.doctype.boe.boe.make_bill_of_entry",
                                        source_name: first_ref.reference_name,
                                        args: {
                                            payment_entry_name: frm.doc.name
                                        }
                                    });
                                },
                                __("Create")
                            );
                        
                    });
            }
        }
    },
  
});
