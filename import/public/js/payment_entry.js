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
                        frm.add_custom_button(
                            __("Bill Of Entry"),
                            function () {
                                // Use server-side method to find valid Pickup Requests
                                frappe.call({
                                    method: "import.import.doctype.boe.boe.get_pickup_requests_for_po",
                                    args: {
                                        po_name: first_ref.reference_name
                                    },
                                    callback: function (response) {
                                        if (response.message && response.message.length > 0) {
                                            frappe.prompt(
                                                {
                                                    label: __("Select Pickup Request"),
                                                    fieldname: "pickup_request",
                                                    fieldtype: "Link",
                                                    options: "Pickup Request",
                                                    get_query: function () {
                                                        return {
                                                            filters: {
                                                                name: ["in", response.message],
                                                                docstatus: 1
                                                            }
                                                        };
                                                    },
                                                    reqd: 1
                                                },
                                                function (values) {
                                                    // Update Payment Entry with selected Pickup Request
                                                    frm.set_value("custom_pickup_request", values.pickup_request);
                                                    frm.save().then(() => {
                                                        // Create Bill of Entry after saving
                                                        frappe.model.open_mapped_doc({
                                                            method: "import.import.doctype.boe.boe.make_bill_of_entry",
                                                            source_name: first_ref.reference_name,
                                                            args: {
                                                                payment_entry_name: frm.doc.name,
                                                                pickup_request: values.pickup_request
                                                            }
                                                        });
                                                    });
                                                },
                                                __("Select Pickup Request"),
                                                __("Create")
                                            );
                                        } else {
                                            frappe.msgprint({
                                                title: __("No Pickup Request Found"),
                                                message: __("No submitted Pickup Request found for Purchase Order {0}", [first_ref.reference_name]),
                                                indicator: "orange"
                                            });
                                        }
                                    }
                                });
                            },
                            __("Create")
                        );
                    });
            }
        }
    }
});